'use strict';

require('dotenv').config();
const path = require('path');
const readline = require('readline');

const config = { env: process.env };
config.debug = (config.env.NODE_ENV==='production')?false:true;
config.env.AUTH_DELAY = config.env.AUTH_DELAY || 300;
config.authDir = path.join(__dirname,'../_authdata');

globalThis.mtp = {};

const user = { phone: config.env.TG_USER_PHONE, forward_id: config.env.TG_FORWARD_ID, id: 0, access_hash: "", code: "", code_hash: "", password: "" };

const isEmpty = (val) => (typeof(val)==='undefined' || !val || !val.length || /^\s*$/.test(val));

const getRandomInt = (max) => Math.floor(Math.random() * Math.floor(max));

const dateToFormat = function (format,date) {
    format = format || "[d/N/Y:H:i:s O]";
    date = date || new Date();
    return format.replace(/Y|m|d|H|i|s|O|N/gi,function(match, offset, str){
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var arr = {};
        arr['Y'] = parseInt(date.getFullYear());
        arr['m'] = parseInt(date.getMonth()+1);
        arr['d'] = parseInt(date.getDate());
        arr['H'] = parseInt(date.getHours());
        arr['i'] = parseInt(date.getMinutes());
        arr['s'] = parseInt(date.getSeconds());
        arr['O'] = -parseInt(date.getTimezoneOffset())/60;
        for (let k in arr) {
          if (k=='O') {
            var a = Math.abs(arr[k]);
            if (a<10) a = "0"+a;
            if (arr[k]<0) arr[k] = "-"+a+"00"; else arr[k] = "+"+a+"00";
          }
          else if (arr[k]<10)
            arr[k] = "0"+arr[k];
        }
        arr['N'] = months[parseInt(date.getMonth())]; // Month from 0 to 11
        return arr[match];
    });
};

const runMTP = async () => {
  try {
    const { mtproto } = require('./mtpapi');

    const startMTP = async () => {
      try {
        if (config.debug) console.log(`mtproto: ${JSON.stringify(mtproto)}`);
        if (!mtproto) throw new Error("No MTProto!");

        const checkHelp = async () => {
          return new Promise ((resolve) => {
            // 2. Get the user country
            mtproto.call('help.getNearestDc').then((result) => {
              if (config.debug) console.log(`mtproto.call('help.getNearestDc') result: ${JSON.stringify(result)}`);
            });
            mtproto.call('help.getAppConfig').then((result) => {
              //if (config.debug) console.log(`mtproto.call('help.getAppConfig') result: ${JSON.stringify(result)}`);
            });
            mtproto.call('help.getConfig').then((result) => {
              //if (config.debug) console.log(`mtproto.call('help.getConfig') result: ${JSON.stringify(result)}`);
            });
            resolve(true);
          });
        };

        const assignUser = (userIn,clear) => {
          if (clear) {
            user.id = 0;
            user.access_hash = '';
            user.phone = userIn.phone;
          } else {
            user.id = parseInt(userIn.id);
            user.access_hash = userIn.access_hash;
            user.phone = userIn.phone;
            user.was_online = userIn.status.was_online;
            if (!isEmpty(userIn.username)) user.username = userIn.username;
            if (!isEmpty(userIn.first_name)) user.first_name = userIn.first_name;
            if (!isEmpty(userIn.last_name)) user.last_name = userIn.last_name;
            if (!isEmpty(userIn.photo.photo_id)) user.photo_id = userIn.photo.photo_id;
          }
        };

        const sendCode = (phone) => {
          return new Promise ((resolve,reject) => {
            if (config.debug) console.log(`mtproto.call('auth.sendCode') to: ${phone}`);
            mtproto.call('auth.sendCode', {
              phone_number: phone,
              settings: {
                _: 'codeSettings',
              },
            })
            .then((result) => {
              if (config.debug) console.log(`mtproto.call('auth.sendCode') result: ${JSON.stringify(result)}`);
              user.code_hash = result.phone_code_hash;
              resolve(result);
            })
            .catch((error) => {
              if (config.debug) console.error(`mtproto.call('auth.sendCode') catching error: ${JSON.stringify(error)}`);
              if (error.error_code == 420) {
                setTimeout(function floodWait(){
                  if (config.debug) console.log(`mtproto.call('auth.sendCode').floodWait() setTimeout`);
                  if (config.env.AUTH_DELAY) var flood = setTimeout(floodWait, config.env.AUTH_DELAY);
                  return reject(false);
                }, config.env.AUTH_DELAY)
              }
            });
          });
        };

        const getCode = async () => {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          return new Promise ((resolve) => {
            return rl.question('Code: ', (answer) => {
              rl.close();
              resolve(answer);
            });
          });
        };

        const signIn = async (phone, cb) => {
          await sendCode(phone)
          .catch((error) => {
            if (error.error_message.includes('_MIGRATE_')) {
              const [type, nextDcId] = error.error_message.split('_MIGRATE_');
              mtproto.setDefaultDc(+nextDcId);
              return sendCode(phone);
            }
          })
          .then(async (result) => {
            var code = user.code = await getCode();
            console.debug(`getCode():`, code);
            mtproto.call('auth.signIn', {
              phone_code: code,
              phone_number: phone,
              phone_code_hash: result.phone_code_hash,
            })
            .catch((error) => {
              if (config.debug) console.error(`mtproto.call('auth.signIn') catching error: ${JSON.stringify(error)}`);
              if (error.error_code==400) sendCode(phone);
            });
          })
          .catch((error) => {
            if (error.error_message === 'SESSION_PASSWORD_NEEDED') {
              mtproto.call('account.getPassword').then(async (result) => {
                const { srp_id, current_algo, srp_B } = result;
                const { salt1, salt2, g, p } = current_algo;
                const { A, M1 } = await getSRPParams({
                  g,
                  p,
                  salt1,
                  salt2,
                  gB: srp_B,
                  password,
                });
                return mtproto.call('auth.checkPassword', {
                  password: {
                    _: 'inputCheckPasswordSRP',
                    srp_id,
                    A,
                    M1,
                  },
                });
              });
            }
          })
          .then((result) => {
            if (!isEmpty(result) && !isEmpty(result.user)) {
              assignUser(result.user, false);
              console.debug(`assignUser() to: ${JSON.stringify(user)}`);
              return cb();
            } else {
              assignUser(user, true);
              console.debug(`assignUser() to: ${JSON.stringify(user)}`);
              signIn(user.phone, getSelfFullUser);
            }
          });
        };

        const logOut = () => {
          return mtproto.call('auth.logOut').then((result) => {
            user.id = 0;
            return result;
          }).catch((error) => {
            if (config.debug) console.error(`mtproto.call('auth.logOut') catching error: ${JSON.stringify(error)}`);
          });
        };

        const getFullUser = async (userId) => {
          return new Promise ((resolve,reject) => {
            mtproto.call('users.getFullUser', userId).then((result) => {
              resolve(result);
            }).catch((error) => {
              if (config.debug) console.error(`mtproto.call('users.getFullUser') catching error: ${JSON.stringify(error)}`);
              if (error.error_code==401) signIn(user.phone, getSelfFullUser);
              reject(error);
            });
          });
        };

        const getSelfFullUser = () => getFullUser({id: { _: 'inputUserSelf' }});

        const sendMessage = async (userId,msg) => {
          const params = {
            peer:{
              _ :'inputPeerUser',
              user_id: userId,
              access_hash: '0'
            },
            message: msg,
            random_id: getRandomInt(1000000)
          };
          const options = {};
          // method, params, options
          return mtproto.call('messages.sendMessage', params, options).then((result) => {
            return result;
          }).catch((error) => {
            if (config.debug) console.error(`mtproto.call('messages.sendMessage') catching error: ${JSON.stringify(error)}`);
          });
        };

        const forwardMessages = async (from,to,msgIds) => {
          var rands = [];
          msgIds.forEach(el => rands.push(getRandomInt(1000000)));
          const params = {
            from_peer: from,
            to_peer: to,
            id: msgIds,
            random_id: rands
          };
          return mtproto.call('messages.forwardMessages', params).then((result) => {
            return result;
          }).catch((error) => {
            if (config.debug) console.error(`mtproto.call('messages.forwardMessages') catching error: ${JSON.stringify(error)}`);
            return false;
          });
        };

        const forwardMessage = async (fromId,toId,msgIds) => {
          var rands = [];
          msgIds.forEach(el => rands.push(getRandomInt(1000000)));
          const params = {
            from_peer: {
              _ :'inputPeerUser',
              user_id: fromId,
              access_hash: 0
            },
            to_peer:{
              _ :'inputPeerUser',
              user_id: toId,
              access_hash: 1
            },
            id: msgIds,
            random_id: rands
          };
          return mtproto.call('messages.forwardMessages', params).then((result) => {
            return result;
          }).catch((error) => {
            if (config.debug) console.error(`mtproto.call('messages.forwardMessages') catching error: ${JSON.stringify(error)}`);
            return false;
          });
        };

        const onUpdate = async () => {
          mtproto.on('updateShort', (message) => {
            if (config.debug) console.log(`mtproto.updates.on('updateShort'): ${JSON.stringify(message)}`);
            const { update } = message;
            if (update._ === 'updateUserStatus') {
              const { user_id, status } = update;
            }
            if (update._ === 'updateUserTyping') {
              const { user_id } = update;
            }
          });

          mtproto.on('updateNewChannelMessage', (message) => {
            if (config.debug) console.log(`mtproto.updates.on('updateNewChannelMessage'): ${JSON.stringify(message)}`);
          });

          mtproto.on('updatesTooLong', (message) => {
            if (config.debug) console.log(`mtproto.updates.on('updatesTooLong'): ${JSON.stringify(message)}`);
          });

          mtproto.on('updatesCombined', (message) => {
            if (config.debug) console.log(`mtproto.updates.on('updatesCombined'): ${JSON.stringify(message)}`);
          });

          mtproto.on('updateShortChatMessage', (message) => {
            if (config.debug) console.log(`mtproto.updates.on('updateShortChatMessage'): ${JSON.stringify(message)}`);
          });

          mtproto.on('updateShortMessage', async (message) => {
            if (config.debug) console.log(`mtproto.updates.on('updateShortMessage'): ${JSON.stringify(message,null,2)}`);
          });

          mtproto.on('updates', async (incoming) => {
            if (config.debug) console.log(`mtproto.updates.on('updates'): ${JSON.stringify(incoming)}`);
          });

        };

        const doError = async (err,exitcode=0) => {
          try {
            if (config.debug) console.error(`startMTP().doError() logging error: ${err}`);
            var text = "startMTP() error: " + err;
            var sentMess = await sendMessage(user.forward_id,text);
            if (exitcode) process.exit(exitcode);
            return sentMess;
          } catch (e) {
            if (config.debug) console.log(`startMTP().doError() catching error: ${e}`);
          }
        };

        if (config.debug) {
          var sentMess = await sendMessage(user.forward_id,`mtpclient restart: ${JSON.stringify(user)}`);
          if (config.debug) console.error(`startMTP().sentMess() result: ${JSON.stringify(sentMess)}`);
        }

        var checked = await checkHelp();
        var gotSFU = await getSelfFullUser();

        if (!isEmpty(gotSFU?.user)) assignUser(gotSFU.user, false);

        return await onUpdate();
      } catch (e) {
        if (config.debug) console.error(`startMTP() catching error: ${e}`);
      }
    };

    return await startMTP();
  } catch (e) {
    if (config.debug) console.error(`runMTP() catching error: ${e}`);
  } finally {
    process.on('uncaughtException', function (err) {
      if (config.debug) console.error(`runMTP() uncaughtException err.stack: ${JSON.stringify(err.stack,null,2)}`);
    });
    process.on('unhandledRejection', function (reason,prom) {
      if (config.debug) console.error(`runMTP() unhandledRejection at: ${JSON.stringify(prom)}; reason: ${reason}`);
    });
    process.on('exit', (code) => {
      if (config.debug) console.debug(`runMTP() exit with code: ${code}`);
    });
  }
};

if (!module.parent) {
  // Start server if file is run directly
  ;(async () => { globalThis.mtp = await runMTP() })().catch(e => console.error(`runMTP() catching error: ${e}`,`catch`))
} else {
  // Export server, if file is referenced via cluster
  module.exports.runMTP = runMTP;
}
