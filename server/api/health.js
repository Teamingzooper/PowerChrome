const storage = require('../lib/storage');
const { withCors, json } = require('../lib/util');

module.exports = withCors(async function (req, res) {
  json(res, 200, {
    ok: true,
    backend: 'powerchrome-api',
    storage: storage.getBackendKind(),
    time: new Date().toISOString()
  });
});
