/**
 * Copyright 2022 Ocean (iiot2k@gmail.com).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

"use strict";

module.exports = function(RED) {

    const dgram = require('dgram');

	RED.nodes.registerType("iiot-ntptime", function(n) {
		var node = this;
		RED.nodes.createNode(node, n);

        node.ntpserver = n.ntpserver;
		node.ampm = n.ampm;
		node.tupdate = n.tupdate;
		node.tout = n.tout;
		node.onWork = false;
		node.ntpclient = dgram.createSocket("udp4");
		node.ntpData = new Buffer.alloc(48);
		node.name = node.ntpserver;

		function outError(errShort, errLong) {
			if (node.save_txt === errShort)
				return true;
		
			node.save_txt = errShort;
			node.status({ fill: "red", shape: "ring", text: errShort });
			node.error(errLong);
		
			return true;
		}
		
		function outText(txt) {
			if (node.save_txt === txt)
				return;
		
			node.save_txt = txt;
			node.status({ fill: "blue", shape: "ring", text: txt });
		}
		

		node.ntpclient.on('message', function(data) {
			clearTimeout(node.id_tout);

			var part1 = 0, part2 = 0;

			for (var i = 0; i <= 3; i++)
				part1 = 256 * part1 + data[40 + i];

			for (i = 4; i <= 7; i++)
				part2 = 256 * part2 + data[40 + i];

			var date = new Date("Jan 01 1900 GMT");

			date.setUTCMilliseconds(date.getUTCMilliseconds() + (part1 * 1000 + (part2 * 1000) / 0x100000000));

			var hr = date.getHours();
			var ap = (hr >= 12) ? 1 : 0;
			var hr = (node.ampm) ? hr % 12 : hr;
			node.send({ payload: [date.getSeconds(), date.getMinutes(), hr, ap, date.getDay(), date.getDate(), date.getMonth() + 1, date.getFullYear()], topic: node.ntpserver });
			outText(node.ntpserver);
			node.onWork = false;
		});

		node.id_tupdate = setInterval(function () {
			if (node.onWork)
				return;
			
			node.onWork = true;

			node.ntpData[0] = 0x1B;

			for (var i = 1; i < 48; i++)
                node.ntpData[i] = 0;

            node.ntpclient.send(node.ntpData, 0, node.ntpData.length, 123, node.ntpserver, function(err) {
                if (err) {
					outError("failure " + node.ntpserver, "server failure " + node.ntpserver);
					node.onWork = false;
				}
				else
					node.id_tout = setTimeout(function () {
						outError("timeout " + node.ntpserver, "server timeout " + node.ntpserver);
						node.onWork = false;
					}, node.tout);
			});
		}, node.tupdate);

		node.on("input", function (msg) {
			if (typeof msg.payload !== "string")
				return;
			
			node.ntpserver = msg.payload;
		});

		node.on('close', function () {
			clearTimeout(node.id_tout);
			clearInterval(node.id_tupdate);
			node.ntpclient.close();
		});
	});
}
