import { setTimeout } from "node:timers/promises";

export const sleep = (ms: number) => setTimeout(ms);
