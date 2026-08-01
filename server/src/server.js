import { env } from "./config/env.js";
import { app } from "./app.js";

app.listen(env.PORT, () => console.log(`A1 Solar MERN API listening on port ${env.PORT}`));
