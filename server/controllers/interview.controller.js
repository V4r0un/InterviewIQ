import fs from 'fs/promises';           // ← Better to import promises directly
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { askAI } from '../services/openRouter.service.js';
import User from '../models/user.model.js';
import Interview from '../models/interview.model.js';

export const analyzeResume = async (req, res) => {
    let filePath = null;
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Resume file is required" });
        }
        filePath = req.file.path;
        console.log("Processing resume:", req.file.originalname);
        // Correct way to read file
        const fileBuffer = await fs.readFile(filePath);
        const uint8Array = new Uint8Array(fileBuffer);
        // Load PDF with better options for Node.js
        const pdf = await pdfjsLib.getDocument({
            data: uint8Array,
            // These help avoid font-related warnings/errors in Node.js
            standardFontDataUrl: null,   // or provide path if you have fonts
        }).promise;
        // Extract text from all pages
        let resumeText = "";
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(" ");
            resumeText += pageText + "\n";
        }
        resumeText = resumeText.replace(/\s+/g, " ").trim();
        if (!resumeText || resumeText.length < 50) {
            throw new Error("Could not extract meaningful text from PDF. Is it a scanned/image-based resume?");
        }
        // Send to AI
        const messages = [
            {
                role: "system",
                content: `You are an expert resume parser. Extract structured data from the resume text.
                Return **only** valid JSON in this exact format, no extra text:
                {
                    "role": "string",
                    "experience": "string (e.g. 3 years)",
                    "projects": ["project name 1", "project name 2"],
                    "skills": ["skill1", "skill2", "skill3"]
                }`
            },
            {
                role: "user",
                content: resumeText
            }
        ];
        const aiResponse = await askAI(messages);
        let parsed;
        try {
            parsed = JSON.parse(aiResponse);
        } catch (parseErr) {
            console.error("AI JSON parse failed:", aiResponse);
            throw new Error("AI returned invalid JSON");
        }
        // Clean up file
        await fs.unlink(filePath);
        filePath = null;
        res.json({
            role: parsed.role || "",
            experience: parsed.experience || "",
            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
            skills: Array.isArray(parsed.skills) ? parsed.skills : [],
            resumeText: resumeText.substring(0, 2000) // limit size if needed
        });
    } catch (error) {
        console.error("Resume Analysis Error:", error);
        // Safe cleanup
        if (filePath && fs.existsSync) {
            try {
                await fs.unlink(filePath);
            } catch (unlinkErr) {
                console.error("Failed to delete file:", unlinkErr);
            }
        }
        return res.status(500).json({
            message: error.message || "Failed to analyze resume",
            // Remove this in production:
            // error: error.stack
        });
    }
};


// Generate Questions based on Resume
export const generateQuestion = async (req,res) => {
    try {
        let { role, experience, mode, resumeText, projects, skills } = req.body;
        role = role?.trim()
        experience = experience?.trim()
        mode = mode?.trim()
        if (!role || !experience || !mode) {
            return res.status(400).json({message: "Role, Experience and Mode are required."})
        }
        const user = await User.findById(req.user?._id || req.user?.id)
        if (!user) {
            return res.status(400).json({message: "User not found."})
        }
        if (user.credits < 50) {
            return res.status(400).json({message: "Not enough credits. Minimum 50 required."})
        }
        const projectText = Array.isArray(projects) && projects.length ? projects.join(", ") : "None"
        const skillsText = Array.isArray(skills) && skills.length ? skills.join(", ") : "None"
        const safeResume = resumeText?.trim() || "None"
        const userPrompt = `
            Role: ${role}
            Experience: ${experience}
            InterviewMode: ${mode}
            Projects: ${projectText}
            Skills: ${skillsText}
            Resume: ${safeResume}
        `
        if (!userPrompt.trim()) {
            return res.status(400).json({message: "Prompt content is empty."})            
        }
        const messages = [
            {
                role: "system",
                content: `
                    You are a real human interviewer conducting a professional interview.
                    
                    Speak in simple, natural English as if you are directly talking to the candidate.
                    
                    Generate exactly 5 interview questions.

                    Strict Rules:
                    - Each question must contain between 15 and 25 words.
                    - Each question must be a single complete sentence.
                    - Do NOT number them.
                    - Do NOT add explainations.
                    - Do NOT add extra text before or after.
                    - One question per line only.
                    - Keep language simple and conversational.
                    - Questions must feel practical and realistic.

                    Doffocult progression:
                    Question 1 -> easy
                    Question 2 -> easy
                    Question 3 -> medium
                    Question 4 -> medium
                    Question 5 -> hard

                    Make questions based on the candidate's role, experience, interviewMode, projects, skills and resume details.
                    `
            },
            {
                role: "user",
                content: userPrompt
            }
        ]
        const aiResponse = await askAI(messages)
        if (!aiResponse || !aiResponse.trim()) {
            return res.status(500).json({message: "AI returned empty response."})
        }
        const questionsArray = aiResponse
            .split("\n")
            .map(q=>q.trim())
            .filter(q => q.length > 0)
            .slice(0, 5)

        if (questionsArray.length === 0) {
            return res.status(500).json({message: "AI failed to generate questions."})
        }

        user.credits -= 50
        await user.save()

        const interview = await Interview.create({
            userId: user._id,
            role,
            experience,
            mode,
            resumeText: safeResume,
            questions: questionsArray.map((q, index) => ({
                question: q,
                difficulty: ["easy","easy","medium","medium","hard"][index],
                timeLimit: [60,60,90,90,120][index],
            }))
        })

        res.json({
            interviewId: interview._id,
            creditsLeft: user.credits,
            userName: user.name,
            questions: interview.questions
        })
    } catch (error) {
        return res.status(500).json({message: `failed to create interview ${error}`}) 
    }
}

// Submitting answers based on the questions asked
export const submitAnswer = async (req, res) => {
    try {
        const { interviewId, questionIndex, answer, timeTaken } = req.body;

        // Basic validation
        if (!interviewId || questionIndex === undefined) {
            return res.status(400).json({ message: "Missing interviewId or questionIndex" });
        }

        const interview = await Interview.findById(interviewId);
        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        // Get the question safely (assuming questions is an array)
        const question = interview.questions[questionIndex];
        if (!question) {
            return res.status(404).json({ message: "Question not found" });
        }

        // If no answer provided
        if (!answer || answer.trim() === "") {
            question.answer = "";
            question.score = 0;
            question.feedback = "You did not submit an answer.";
            await interview.save();
            return res.json({ feedback: question.feedback });
        }

        // If time limit exceeded
        if (timeTaken > question.timeLimit) {
            question.answer = answer;
            question.score = 0;
            question.feedback = "Time limit exceeded. Answer not evaluated.";
            await interview.save();
            return res.json({ feedback: question.feedback });
        }

        // Prepare prompt for AI
        const messages = [
            {
                role: "system",
                content: `
You are a professional human interviewer evaluating a candidate's answer.

Evaluate naturally and fairly.

Score from 0 to 10 in these areas:
1. Confidence     - Sounds clear, confident, and well-presented?
2. Communication  - Language is simple, clear, and easy to understand?
3. Correctness    - Answer is accurate, relevant, and complete?

Rules:
- Be realistic and strict. Do not give random high scores.
- Calculate finalScore as average of the three scores, rounded to nearest whole number.

Return ONLY valid JSON in this exact format (no extra text):
{
    "confidence": number,
    "communication": number,
    "correctness": number,
    "finalScore": number,
    "feedback": "Short feedback, 10-15 words max, sounds like real interviewer"
}
                `
            },
            {
                role: "user",
                content: `Question: ${question.question}\nAnswer: ${answer}`
            }
        ];

        const aiResponse = await askAI(messages);
        let parsed;

        try {
            parsed = JSON.parse(aiResponse);
        } catch (parseError) {
            console.error("AI response parse failed:", aiResponse);
            // Fallback
            question.answer = answer;
            question.score = 5;
            question.feedback = "Answer received but could not be evaluated properly.";
            await interview.save();
            return res.json({ feedback: question.feedback });
        }

        // Save the evaluated result
        question.answer = answer;
        question.confidence = parsed.confidence || 5;
        question.communication = parsed.communication || 5;
        question.correctness = parsed.correctness || 5;
        question.score = parsed.finalScore || Math.round((parsed.confidence + parsed.communication + parsed.correctness) / 3) || 5;
        question.feedback = parsed.feedback || "Answer recorded.";

        await interview.save();

        return res.status(200).json({ 
            feedback: parsed.feedback,
            score: question.score 
        });

    } catch (error) {
        console.error("Submit Answer Error:", error);
        return res.status(500).json({ 
            message: "Failed to submit answer",
            error: error.message 
        });
    }
};

export const finishedInterview = async (req, res) => {
    try {
        const { interviewId } = req.body;
        if (!interviewId) {
            return res.status(400).json({ message: "interviewId is required" });
        }
        // Calculate final scores
        const interview = await Interview.findById(interviewId);
        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
        }
        const totalQuestions = interview.questions?.length || 0;
        if (totalQuestions === 0) {
            return res.status(400).json({ message: "No questions found in interview" });
        }
        let totalScore = 0;
        let totalConfidence = 0;
        let totalCommunication = 0;
        let totalCorrectness = 0;
        interview.questions.forEach(q => {
            totalScore += q.score || 0;
            totalConfidence += q.confidence || 0;
            totalCommunication += q.communication || 0;
            totalCorrectness += q.correctness || 0;
        });
        const finalScore = totalScore / totalQuestions;
        const avgConfidence = totalConfidence / totalQuestions;
        const avgCommunication = totalCommunication / totalQuestions;
        const avgCorrectness = totalCorrectness / totalQuestions;
        // Update interview with final results
        const updatedInterview = await Interview.findByIdAndUpdate(
            interviewId,
            {
                finalScore: finalScore,
                status: "Completed",           // Make sure "completed" is in your enum
            },
            { 
                new: true,           // Return updated document
                runValidators: true  // Ensure validation runs
            }
        );

        if (!updatedInterview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        return res.status(200).json({
            message: "Interview completed successfully",
            finalScore: Number(finalScore.toFixed(1)),
            confidence: Number(avgConfidence.toFixed(1)),
            communication: Number(avgCommunication.toFixed(1)),
            correctness: Number(avgCorrectness.toFixed(1)),
            questionWiseScore: updatedInterview.questions.map((q) => ({
                question: q.question,
                score: q.score || 0,
                feedback: q.feedback || "",
                communication: q.communication || 0,
                correctness: q.correctness || 0,
            }))
        });

    } catch (error) {
        console.error("Error in finishedInterview:", error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: "Validation Error",
                error: error.message,
                details: Object.values(error.errors).map(err => ({
                    field: err.path,
                    message: err.message,
                    value: err.value
                }))
            });
        }
        return res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

export const getMyInterviews = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const interviews = await Interview.find({ userId })
            .sort({ createdAt: -1 })        // ← yeh sahi hai (assuming createdAt field)
            .select("role experience mode finalScore status createdAt questions")  // questions agar chahiye toh
            .lean();   // thoda faster

        return res.status(200).json(interviews || []);
    } catch (error) {
        console.error("Get My Interviews Error:", error);
        return res.status(500).json({
            message: "Failed to fetch interviews",
            error: error.message
        });
    }
}

export const getInterviewReport = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id)
        if (!interview) {
            return res.status(400).json({
                message: "Interview not found"
            })
        }
        const totalQuestions = interview.questions?.length || 0;
        if (totalQuestions === 0) {
            return res.status(400).json({ message: "No questions found in interview" });
        }
        let totalConfidence = 0;
        let totalCommunication = 0;
        let totalCorrectness = 0;
        interview.questions.forEach(q => {
            totalConfidence += q.confidence || 0;
            totalCommunication += q.communication || 0;
            totalCorrectness += q.correctness || 0;
        });
        const avgConfidence = totalConfidence / totalQuestions;
        const avgCommunication = totalCommunication / totalQuestions;
        const avgCorrectness = totalCorrectness / totalQuestions;
        return res.json({
            finalScore: interview.finalScore,
            confidence: Number(avgConfidence.toFixed(1)),
            communication: Number(avgCommunication.toFixed(1)),
            correctness: Number(avgCorrectness.toFixed(1)),
            questionWiseScore: interview.questions
        })
    } catch (error) {
        return res.status(500).json({
            message: "Failed to find current user interview report",
            error: error.message
        });
    }
}