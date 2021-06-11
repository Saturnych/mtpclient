'use strict';

require('dotenv').config();

const config = { env: process.env };
config.debug = (config.env.NODE_ENV==='production')?false:true;

globalThis.exitcode = 0;

const { runMTP } = require('./mtpclient');

const runMain = async () => {
  try {
    globalThis.date = new Date();
    globalThis.now = Math.round(Date.now());

    console.debug(`date: ${globalThis.date} | now: ${globalThis.now}`);

    globalThis.mtp = await runMTP();
  } catch (e) {
    if (config.debug) console.error(`runMain() catching error: ${e}`);
  } finally {
    process.on('uncaughtException', function (err) {
      if (config.debug) console.error(`runMain() uncaughtException err.stack: ${JSON.stringify(err.stack,null,2)}`);
    });
    process.on('unhandledRejection', function (reason,prom) {
      if (config.debug) console.error(`runMain() unhandledRejection at: ${JSON.stringify(prom)}; reason: ${reason}`);
    });
    process.on('exit', (code) => {
      if (config.debug) console.debug(`runMain() exit with code: ${code}`);
    });
  }
};

;(async () => { return await runMain(); })().catch(e => console.error(`runMain() catching error: ${e}`))
