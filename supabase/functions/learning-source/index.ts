import { handleLearningSource } from "./handler.ts";
Deno.serve((req) => handleLearningSource(req));
