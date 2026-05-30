import { google } from 'googleapis';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
  ],
});

console.log('\n1. Open this URL in your browser (sign in as amisesuite@gmail.com):\n');
console.log(authUrl);
console.log('\n2. After approving, Google shows a code. Paste it below.\n');

const rl = readline.createInterface({ input, output });
const code = (await rl.question('Authorisation code: ')).trim();
rl.close();

const { tokens } = await oauth2Client.getToken(code);
console.log('\n✓ Add these to your api-server .env.local:\n');
console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`);
console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`);
console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
