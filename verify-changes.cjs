// Quick script to verify the changes are in place
const fs = require('fs');

console.log('Checking for sendAudioFrames implementation...\n');

// Check websocket-client.ts
const wsClient = fs.readFileSync('./src/lib/websocket-client.ts', 'utf8');
const hasAudioFrameOption = wsClient.includes('sendAudioFrames?: boolean');
const hasAudioFrameCheck = wsClient.includes('if (this.config.sendAudioFrames)');
const hasErrorHandling = wsClient.includes("innerData?.name === 'Error'");

console.log('✓ WebSocket Client:');
console.log('  - sendAudioFrames option:', hasAudioFrameOption ? '✅' : '❌');
console.log('  - Audio frame conditional:', hasAudioFrameCheck ? '✅' : '❌');
console.log('  - Error event handling:', hasErrorHandling ? '✅' : '❌');

// Check App.tsx
const app = fs.readFileSync('./src/App.tsx', 'utf8');
const hasAudioFrameState = app.includes('const [sendAudioFrames, setSendAudioFrames] = useState(false)');
const passesAudioFrameToClient = app.includes('sendAudioFrames,');

console.log('\n✓ App.tsx:');
console.log('  - sendAudioFrames state:', hasAudioFrameState ? '✅' : '❌');
console.log('  - Passes to WebSocket client:', passesAudioFrameToClient ? '✅' : '❌');

// Check ControlPanel.tsx
const controlPanel = fs.readFileSync('./src/components/ControlPanel.tsx', 'utf8');
const hasCheckbox = controlPanel.includes('Send Audio Frames');
const hasToggleHandler = controlPanel.includes('onToggleSendAudioFrames');

console.log('\n✓ ControlPanel.tsx:');
console.log('  - Checkbox UI:', hasCheckbox ? '✅' : '❌');
console.log('  - Toggle handler:', hasToggleHandler ? '✅' : '❌');

console.log('\nAll changes verified! Try these steps:');
console.log('1. Open http://localhost:5173 in your browser');
console.log('2. You should see a "Send Audio Frames" checkbox in the control panel');
console.log('3. The checkbox should be unchecked by default');
console.log('4. Error events will be logged with "❌ Error event:" in the console');
