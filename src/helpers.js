'use strict';

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

module.exports = { isEmpty, getRandomInt, dateToFormat }
