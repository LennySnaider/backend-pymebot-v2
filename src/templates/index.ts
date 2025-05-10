/**
 * backend/src/flows/index.ts
 * Archivo central que combina todos los flujos del bot
 * @version 1.0.0
 * @updated 2024-02-01
 */

import { createFlow } from "@builderbot/bot";
import { mainFlow } from "./mainFlow";
import { faqFlow } from "./faqFlow";

// Combina todos los flujos disponibles en un solo flujo principal
export default createFlow([mainFlow, faqFlow]);
