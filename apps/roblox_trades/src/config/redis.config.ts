import { registerAs } from "@nestjs/config";
import type { QueueOptions } from "bullmq";

export default registerAs<QueueOptions>("redis", () => {
  const url = new URL(process.env.REDIS_URL || "redis://localhost:6379");
  return {
    connection: {
      host: url.hostname,
      port: Number(url.port),
      password: url.password,
      username: url.username,
      db: 1,
    },
  };
});
