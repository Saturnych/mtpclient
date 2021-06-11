'use strict';

require('dotenv').config();
const path = require('path');
const MTProto = require('@mtproto/core');
const { sleep } = require('@mtproto/core/src/utils/common');

const config = { env: process.env };
config.debug = (config.env.NODE_ENV==='production')?false:true;
config.env.AUTH_DELAY = config.env.AUTH_DELAY || 300;
config.authPath = path.join(__dirname, '../_authdata', './'+config.env.TG_USER_PHONE+'.json');

class API {
  constructor() {
    this.mtproto = new MTProto({
      api_id: config.env.TG_API_ID,
      api_hash: config.env.TG_API_HASH,
      //test: false,
      //customLocalStorage: globalThis.localStorage,
      storageOptions: {
        path: config.authPath
      },
    });
  }

  async on(type, cb) {
    try {
      return await this.mtproto.updates.on(type, cb);
    } catch (error) {
      console.log(`${method} error:`, error);
      return Promise.reject(error);
    }
  }

  async call(method, params, options = {}) {
    try {
      const result = await this.mtproto.call(method, params, options);

      return result;
    } catch (error) {
      console.log(`${method} error:`, error);

      const { error_code, error_message } = error;

      if (error_code === 420) {
        const seconds = Number(error_message.split('FLOOD_WAIT_')[1]);
        const ms = seconds * 1000;

        await sleep(ms);

        return this.call(method, params, options);
      }

      if (error_code === 303) {
        const [type, dcIdAsString] = error_message.split('_MIGRATE_');

        const dcId = Number(dcIdAsString);

        // If auth.sendCode call on incorrect DC need change default DC, because
        // call auth.signIn on incorrect DC return PHONE_CODE_EXPIRED error
        if (type === 'PHONE') {
          await this.mtproto.setDefaultDc(dcId);
        } else {
          Object.assign(options, { dcId });
        }

        return this.call(method, params, options);
      }

      return Promise.reject(error);
    }
  }
}

const mtproto = new API();

module.exports = { mtproto };
