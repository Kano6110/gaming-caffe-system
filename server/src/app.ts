import express from "express";
import authRoutes from "./routes/auth.routes";
import computerRoutes from "./routes/computer.routes";
const app= express();


app.use(express.json());
app.use("/auth", authRoutes);

app.use("/comp",computerRoutes);

app.get("/", (req, res) => {
  res.send("Hello World!");
});


export default app;