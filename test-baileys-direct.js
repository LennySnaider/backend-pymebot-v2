#!/usr/bin/env node

/**
 * TEST DIRECTO CON BAILEYS - SIN BUILDERBOT
 * Prueba directa de la librería Baileys para WhatsApp
 */

import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qr from 'qr-image';
import fs from 'fs';

console.log('🔄 Iniciando test directo con Baileys...');

const connectToWhatsApp = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: {
            level: 'silent',
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            fatal: () => {},
            child: () => ({
                level: 'silent',
                trace: () => {},
                debug: () => {},
                info: () => {},
                warn: () => {},
                error: () => {},
                fatal: () => {}
            })
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr: qrCode } = update;
        
        if (qrCode) {
            console.log('📋 QR Code generado!');
            const qrImage = qr.image(qrCode, { type: 'png' });
            qrImage.pipe(fs.createWriteStream('baileys-qr.png'));
            console.log('💾 QR guardado como baileys-qr.png');
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('🔌 Conexión cerrada. Código:', statusCode, 'Reconectar:', shouldReconnect);
            if (shouldReconnect) {
                console.log('🔄 Intentando reconectar...');
                setTimeout(() => connectToWhatsApp(), 3000);
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp conectado exitosamente!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            console.log('📨 Mensaje recibido:', msg.message?.conversation || 'mensaje sin texto');
            
            if (msg.message?.conversation?.toLowerCase() === 'hola') {
                await sock.sendMessage(msg.key.remoteJid, { text: '¡Hola! Test de Baileys funcionando ✅' });
            }
        }
    });
};

connectToWhatsApp().catch(err => console.error('💥 Error:', err));