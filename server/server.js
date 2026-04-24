const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   DATABASE CONNECTION
========================= */
mongoose.connect("mongodb://127.0.0.1:27017/animeflyx");

/* =========================
   USER MODEL
========================= */
const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    history: [
        {
            malId: Number,
            title: String,
            image: String,
            episode: Number,
            type: String,
            time: Number // seconds for resume playback
        }
    ]
});

const User = mongoose.model("User", UserSchema);

/* =========================
   REGISTER
========================= */
app.post("/register", async (req, res) => {
    const { username, password } = req.body;

    const exists = await User.findOne({ username });
    if (exists) return res.json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
        username,
        password: hashed,
        history: []
    });

    res.json({ success: true });
});

/* =========================
   LOGIN
========================= */
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.json({ error: "User not found" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ error: "Wrong password" });

    const token = jwt.sign({ id: user._id }, "SECRET_KEY");

    res.json({ token });
});

/* =========================
   SAVE WATCH PROGRESS
========================= */
app.post("/progress", async (req, res) => {
    const { token, anime } = req.body;

    try {
        const decoded = jwt.verify(token, "SECRET_KEY");

        const user = await User.findById(decoded.id);

        // remove old entry for same anime
        user.history = user.history.filter(h => h.malId !== anime.malId);

        // add new updated entry
        user.history.unshift(anime);

        // keep only last 20
        user.history = user.history.slice(0, 20);

        await user.save();

        res.json({ success: true });

    } catch (e) {
        res.json({ error: "Invalid token" });
    }
});

/* =========================
   CONTINUE WATCHING
========================= */
app.get("/continue/:token", async (req, res) => {
    try {
        const decoded = jwt.verify(req.params.token, "SECRET_KEY");

        const user = await User.findById(decoded.id);

        res.json(user.history.slice(0, 10));

    } catch (e) {
        res.json([]);
    }
});

/* =========================
   UPDATE WATCH TIME (REAL RESUME SUPPORT)
========================= */
app.post("/time", async (req, res) => {
    const { token, malId, time } = req.body;

    try {
        const decoded = jwt.verify(token, "SECRET_KEY");

        const user = await User.findById(decoded.id);

        const anime = user.history.find(h => h.malId === malId);

        if (anime) {
            anime.time = time;
        }

        await user.save();

        res.json({ success: true });

    } catch (e) {
        res.json({ error: "failed" });
    }
});

/* =========================
   START SERVER
========================= */
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
