const argon2 = require('argon2');
argon2.hash('Testpass123', { type: argon2.argon2id }).then(h => console.log(h));
