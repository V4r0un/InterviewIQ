import User from "../models/user.model.js"
import jwt from 'jsonwebtoken'

export const googleAuth = async (req,res) => {
    try {
        console.log("=== GOOGLE AUTH HIT ===");
        console.log("BODY:", req.body);
        console.log("JWT_SECRET:", process.env.JWT_SECRET ? "EXISTS" : "MISSING");

        const { name, email } = req.body;

        if (!email) {
            return res.status(400).json({message: "Email is required"});
        }

        let user = await User.findOne({ email });
        console.log("USER FOUND:", user);

        if (!user) {
            user = await User.create({ name, email });
            console.log("USER CREATED:", user);
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log("TOKEN CREATED");

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json(user);

    } catch (error) {
        console.error("FULL ERROR:", error);
        return res.status(500).json({
            message: "Google Auth Error",
            error: error.message
        });
    }
};

export const logOut = async (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: false,
            sameSite: "strict"
        })
        return res.status(200).json({message: "logout successfully"});
    } catch (error) {
        return res.status(500).json({message: `LogOut Error ${error}`})
    }
}