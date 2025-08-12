#!/usr/bin/env node

/**
 * TEST SIMPLE DE WHATSAPP - SOLO QR Y CONEXIÓN
 * Este script prueba únicamente la generación de QR y conexión básica
 */

import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot';
import { BaileysProvider } from '@builderbot/provider-baileys';

console.log('🔄 Iniciando test simple de WhatsApp...');

// Flujo básico de prueba
const testFlow = createFlow([
    addKeyword('hola').addAnswer('¡Hola! Conexión WhatsApp exitosa ✅')
]);

const main = async () => {
    try {
        console.log('📱 Configurando proveedor WhatsApp...');
        
        const provider = createProvider(BaileysProvider, {
            name: 'test-simple',
            sessionDir: './sessions-test',
            qrPath: './test-qr.png'
        });

        console.log('🤖 Creando bot...');
        const bot = createBot({
            flow: testFlow,
            provider,
            database: undefined
        });

        console.log('🚀 Bot iniciado. Esperando QR...');
        
        // Evento cuando se genera QR
        provider.on('qr', (qr) => {
            console.log('📋 QR generado - Escanéalo con WhatsApp');
            console.log('🌐 QR disponible en: ./test-qr.png');
        });

        // Evento cuando se conecta
        provider.on('ready', () => {
            console.log('✅ WhatsApp conectado exitosamente!');
            console.log('💬 Envía "hola" para probar');
        });

        // Evento de errores
        provider.on('error', (error) => {
            console.error('❌ Error:', error);
        });

        // Mantener el proceso vivo
        process.on('SIGINT', () => {
            console.log('\n👋 Cerrando bot...');
            process.exit(0);
        });

    } catch (error) {
        console.error('💥 Error iniciando bot:', error);
        process.exit(1);
    }
};

main();