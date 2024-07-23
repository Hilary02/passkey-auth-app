const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const app = express();
const port = 5001;

app.use(cors());
app.use(express.json());

// ユーザーデータベースの代わりに使用する簡易的なオブジェクト
const users = {};

// WebAuthnの設定
const rpName = 'WebAuthn Demo';
const rpID = 'localhost';
const origin = `http://${rpID}:3000`;

// ユーザーIDを生成する関数
function generateUserID(username) {
  return crypto.createHash('sha256').update(username).digest();
}

app.post('/generate-registration-options', async (req, res) => {
  const { username } = req.body;

  // ユーザーが存在しない場合、新規作成
  if (!users[username]) {
    const userID = generateUserID(username);
    users[username] = {
      id: userID,
      username,
      devices: [],
    };
  }

  const user = users[username];

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });

  // チャレンジを保存（実際のアプリケーションではセッションに保存するべきです）
  user.currentChallenge = options.challenge;

  res.json(options);
});

app.post('/verify-registration', async (req, res) => {
  const { username, response } = req.body;

  const user = users[username];
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = registrationInfo;

      const existingDevice = user.devices.find(
        (device) => Buffer.compare(device.credentialID, credentialID) === 0
      );

      if (!existingDevice) {
        // 新しい認証器を保存
        user.devices.push({
          credentialPublicKey,
          credentialID,
          counter,
        });
      }
    }

    res.json({ verified });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/generate-authentication-options', (req, res) => {
  const { username } = req.body;

  const user = users[username];
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  const options = generateAuthenticationOptions({
    rpID,
    allowCredentials: user.devices.map((device) => ({
      id: device.credentialID,
      type: 'public-key',
    })),
    userVerification: 'preferred',
  });

  // チャレンジを保存（実際のアプリケーションではセッションに保存するべきです）
  user.currentChallenge = options.challenge;

  res.json(options);
});

app.post('/verify-authentication', async (req, res) => {
  const { username, response } = req.body;

  const user = users[username];
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  const expectedChallenge = user.currentChallenge;

  try {
    const device = user.devices.find(
      (device) =>
        Buffer.compare(
          device.credentialID,
          Buffer.from(response.id, 'base64')
        ) === 0
    );

    if (!device) {
      throw new Error('Authenticator is not registered with this site');
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: device,
    });

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // 認証器のカウンターを更新
      device.counter = authenticationInfo.newCounter;
    }

    res.json({ verified });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
