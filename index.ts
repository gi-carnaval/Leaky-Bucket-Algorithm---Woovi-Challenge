import { app } from "./src";
import { connectRedis } from "./src/lib/redis";

connectRedis()

app.listen(3000, () => null);