import "dotenv/config";
import app from "./app";
import {startSessionSweep}from "./utils/session.sweep.job";
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  startSessionSweep();
});

