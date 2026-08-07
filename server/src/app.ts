import express from "express";
import authRoutes from "./routes/auth.routes";
import computerRoutes from "./routes/computer.routes";
import sessionRoutes from "./routes/session.routes";
const app= express();


app.use(express.json());
app.use("/auth", authRoutes);

app.use("/comp",computerRoutes);
app.use("/sessions", sessionRoutes);

app.get("/", (req, res) => {
  res.send("Hello World!");
});


export default app;