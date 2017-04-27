#!/usr/bin/env node
const exec = require('child_process').exec;
const ping = require('net-ping');
const REFRESH_INDEX = 10000;

const actions = {
	'f4:42:8f:f3:29:c8': {
		requiredDisconnectedTime: 60 * 10, //Seconds, 10 minutes
		action: function() {
			var hour = new Date().getHours();
			//If it's later than 6pm or earlier than 4am
			if ( hour > 18 || hour < 4 ) {
				console.log('Waking up lights!');
				exec('/bin/bash lights-auto.sh');
			}
		}
	}
};

var session = ping.createSession({
	timeout: 100,
	ttl: 64,
	retries: 2
});
var list = {};

function main() {

	var prevList = list;
	getListOfDevices();
	checkIfHostsOnline();

	setTimeout(() => {
		main();
	}, REFRESH_INDEX);

};

function checkIfHostsOnline() {

	for ( var key in list ) {
		if (! list.hasOwnProperty(key) ) continue;
		
		(function(ch){

				session.pingHost(ch.ip, function(err, target){
					if ( err ) {
						hostGone(ch);
						return false;
					}
					hostActive(ch,target);
				});

		})(list[key]);

	}

};

function handleReconnect(ch, lc) {
	if (! actions.hasOwnProperty(ch.hwa) ) {
		console.log('Reconnect on ' + ch.hwa + ' - ' + ch.ip + ', but no action registered');
		return false;
	}

	if ( lc >= actions[ch.hwa].requiredDisconnectedTime ) {
		actions[ch.hwa].action();
	} else {
		console.log('Reconnect on ' + ch.hwa + ' - ' + ch.ip + ', but time not longer enough for proc');
console.log(lc + ':' + actions[ch.hwa].requiredDisconnectedTime);
	}

}

function hostActive(ch, data) {

	console.log('Host ' + ch.ip + ' is active');

	if ( ch.active === false ) {
		var lc = new Date().getTime() / 1000;
		if ( ch.lastSeen > 0 ) {
			lc = lc - ch.lastSeen;
			handleReconnect(ch,lc);
		}
	}
	
	list[ch.hwa].active = true;
	list[ch.hwa].lastSeen = new Date().getTime() / 1000;
}
function hostGone(ch) {
	list[ch.hwa].active = false;
}

function getListOfDevices() {

	exec('arp -an', handleRawList);

};

function handleRawList(err,stdout,stderr) {

	"use strict";

	var s = stdout.split("\n");
	if ( s.length < 1 ) return;
	console.log(s.length);

	for ( var i=0; i<s.length; i++ ) {
		let line = s[i];
		let ls = line.split(" ");
		if ( ls.length !== 7 ) continue

		let ip = ls[1].replace('(','');
		ip = ip.replace(')','');
		
		let hwa = ls[3];

		injectDevices(ip,hwa);

	}


};

function injectDevices(ip,hwa) {

	"use strict";

	if ( list.hasOwnProperty(hwa) ) return;

	list[hwa] = {
		ip: ip,
		hwa: hwa,
		active: false,
		lastSeen: 0
	};

}

main();
