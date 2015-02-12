/*
 var vid = new Whammy.Video();
 vid.add(canvas or data url)
 vid.compile()
 */


window.Whammy = (function() {

// in this case, frames has a very specific meaning, which will be 
// detailed once i finish writing the code

    function toWebM(frames, outputAsArray, hasAudio, audioByteStream) {
        var info = checkFrames(frames);
        //max duration by cluster in milliseconds
        var CLUSTER_MAX_DURATION = 30000;
        var EBML = [
            {
                "id": 0x1a45dfa3, // EBML
                "data": [
                    {
                        "data": 1,
                        "id": 0x4286 // EBMLVersion
                    },
                    {
                        "data": 1,
                        "id": 0x42f7 // EBMLReadVersion
                    },
                    {
                        "data": 4,
                        "id": 0x42f2 // EBMLMaxIDLength
                    },
                    {
                        "data": 8,
                        "id": 0x42f3 // EBMLMaxSizeLength
                    },
                    {
                        "data": "webm",
                        "id": 0x4282 // DocType
                    },
                    {
                        "data": 2,
                        "id": 0x4287 // DocTypeVersion
                    },
                    {
                        "data": 2,
                        "id": 0x4285 // DocTypeReadVersion
                    }
                ]
            },
            {
                "id": 0x18538067, // Segment
                "data": [
                    {
                        "id": 0x1549a966, // Info
                        "data": [
                            {
                                "data": 1e6, //do things in millisecs (num of nanosecs for duration scale)
                                "id": 0x2ad7b1 // TimecodeScale
                            },
                            {
                                "data": "whammy",
                                "id": 0x4d80 // MuxingApp
                            },
                            {
                                "data": "whammy",
                                "id": 0x5741 // WritingApp
                            },
                            {
                                "data": doubleToString(info.duration),
                                "id": 0x4489 // Duration
                            }
                        ]
                    },
                    {
                        "id": 0x1654ae6b, // Tracks
                        "data": [
                            {
                                "id": 0xae, // TrackEntry
                                "data": [
                                    {
                                        "data": 1,
                                        "id": 0xd7 // TrackNumber
                                    },
                                    {
                                        "data": 1,
                                        "id": 0x63c5 // TrackUID
                                    },
                                    {
                                        "data": 0,
                                        "id": 0x9c // FlagLacing
                                    },
                                    {
                                        "data": "und",
                                        "id": 0x22b59c // Language
                                    },
                                    {
                                        "data": "V_VP8",
                                        "id": 0x86 // CodecID
                                    },
                                    {
                                        "data": "VP8",
                                        "id": 0x258688 // CodecName
                                    },
                                    {
                                        "data": 1,
                                        "id": 0x83 // TrackType
                                    },
                                    {
                                        "id": 0xe0, // Video
                                        "data": [
                                            {
                                                "data": info.width,
                                                "id": 0xb0 // PixelWidth
                                            },
                                            {
                                                "data": info.height,
                                                "id": 0xba // PixelHeight
                                            }
                                        ]
                                    }
                                ]
                            }


                        ]
                    }
                    //cluster insertion point
                ]
            }
        ];
        if (hasAudio) {
            var getAudioFrame = function(shift) {
                shift = shift || 0;

                this.header = this.header ||  audioByteStream.slice(shift, shift + 4);

                var samplingFreqLookup = [[44100, 48000, 32000], [22050, 24000, 16000]];
                var bitrateLookup = [
                    [
                        [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
                        [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
                        [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 320]
                    ],
                    [
                        [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
                        [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
                    ]
                ];
                var layerLookup = ["", 3, 2, 1];
                var versionLookup = [2.5, "", 2, 1];
                var samplesPerFrameLookup = [[// MPEG Version 1
                        384, // Layer1
                        1152, // Layer2
                        1152    // Layer3
                    ],
                    [// MPEG Version 2 & 2.5
                        384, // Layer1
                        1152, // Layer2
                        576     // Layer3
                    ]];

                this.sampleRateFlag = this.sampleRateFlag || (toDecimal(header.slice(2, 3)) & 0x0c) >> 2;
                this.bitrateFlag = this.bitrateFlag || (toDecimal(header.slice(2, 3)) & 0xf0) >> 4;


                this.version = this.version || versionLookup[(toDecimal(header.slice(1, 2)) & 0x30) >> 4];


                this.sampleRate = this.sampleRate || samplingFreqLookup[version - 1][sampleRateFlag];
                this.layer = this.layer || layerLookup[((toDecimal(header.slice(1, 2)) & 0x06) >> 1)];
                this.bitrate = this.bitrate || bitrateLookup[version - 1][layer - 1][bitrateFlag] * 1000;
                this.padding = this.padding || (toDecimal(header.slice(2, 3)) & 0x02) >> 1;
                this.frameDuration = this.frameDuration || (samplesPerFrameLookup[version - 1][layer - 1] / sampleRate) * 1000;
                
                if(!this.frameSize){
                  if (layer === 1) {
                    this.frameSize = (12 * this.bitrate / this.sampleRate + this.padding) * 4;
                  } else if (this.layer === 2 || this.layer === 3) {
                    this.frameSize = 144 * this.bitrate / this.sampleRate + this.padding;
                  } else {
                    throw "Unknown mp3 layer number";
                  }
                  this.frameSize = Math.floor(this.frameSize);
                }

                return {
                    version: this.version,
                    sampleRate: this.sampleRate,
                    layer: this.layer,
                    bitrate: this.bitrate,
                    size: this.frameSize,
                    duration: this.frameDuration,
                    frame: audioByteStream.slice(shift, shift + this.frameSize)
                };
            };
            var frame = getAudioFrame();

            EBML[1]['data'][1]['data'].push({
                "id": 0xae, // TrackEntry
                "data": [
                    {
                        "data": 2,
                        "id": 0xd7 // TrackNumber
                    },
                    {
                        "data": 2,
                        "id": 0x63c5 // TrackUID
                    },
                    {
                        "data": 0,
                        "id": 0x9c // FlagLacing
                    },
                    {
                        "data": "und",
                        "id": 0x22b59c // Language
                    },
                    {
                        "data": "A_MPEG/L3",
                        "id": 0x86 // CodecID
                    },
                    {
                        "data": "MPEG Audio 1, 2, 2.5 Layer III",
                        "id": 0x258688 // CodecName
                    },
                    {
                        "data": 2,
                        "id": 0x83 // TrackType
                    },
                    {
                        "id": 0xe1, // Audio
                        "data": [
                            {
                                "data": 2,
                                "id": 0x9f // Channels
                            },
                            /*{ 
                             "data": 524288,
                             "id": 0x6264 // BitDepth
                             },*/
                            {
                                "data": frame.sampleRate,
                                "id": 0x78 //Sampling Frequency
                            }
                        ]
                    }
                ]});
        }


//Generate clusters (max duration)
        var frameNumber = 0;
        var clusterTimecode = 0;
        var audioShift = 0;
        while (frameNumber < frames.length) {
            var clusterFrames = [];
            var clusterDuration = 0;
            do {
                clusterFrames.push(frames[frameNumber]);
                clusterDuration += frames[frameNumber].duration;
                frameNumber++;
            } while (frameNumber < frames.length && clusterDuration < CLUSTER_MAX_DURATION);

            var clusterCounter = 0;
            var audioDuration = 0;

            var cluster = {
                "id": 0x1f43b675, // Cluster
                "data": [
                    {
                        "data": Math.round(clusterTimecode),
                        "id": 0xe7 // Timecode
                    }]
            };

            for (var i = 0, cnt = clusterFrames.length; i < cnt; i++) {
                var webp = clusterFrames[i];
                var block = makeSimpleBlock({
                    discardable: 0,
                    frame: webp.data.slice(4),
                    invisible: 0,
                    keyframe: 1,
                    lacing: 0,
                    trackNum: 1,
                    timecode: Math.round(clusterCounter)
                });

                cluster.data = cluster.data.concat([
                    {
                        data: block,
                        id: 0xa3
                    }]);

                if (hasAudio) {
                    do {
                        var frame = getAudioFrame(audioShift);
                        var audioBlock = makeSimpleBlock({
                            discardable: 0,
                            frame: frame.frame,
                            invisible: 0,
                            keyframe: 1,
                            lacing: 0,
                            trackNum: 2,
                            timecode: audioDuration
                        });
                        audioShift += frame.size;
                        cluster.data = cluster.data.concat([
                            {
                                "data": audioBlock,
                                "id": 0xa3
                            }]);
                        audioDuration += frame.duration;
                    } while (audioDuration < (clusterCounter + webp.duration));
                }
                clusterCounter += webp.duration;
            }

//Add cluster to segment
            EBML[1].data.push(cluster);
            clusterTimecode += clusterDuration;
        }

        return generateEBML(EBML, outputAsArray)
    }

// sums the lengths of all the frames and gets the duration, woo

    function checkFrames(frames) {
        var width = frames[0].width,
                height = frames[0].height,
                duration = frames[0].duration;
        for (var i = 1; i < frames.length; i++) {
            if (frames[i].width != width)
                throw "Frame " + (i + 1) + " has a different width";
            if (frames[i].height != height)
                throw "Frame " + (i + 1) + " has a different height";
            if (frames[i].duration < 0 || frames[i].duration > 0x7fff)
                throw "Frame " + (i + 1) + " has a weird duration (must be between 0 and 32767)";
            duration += frames[i].duration;
        }
        return {
            duration: duration,
            width: width,
            height: height
        };
    }


    function numToBuffer(num) {
        var parts = [];
        while (num > 0) {
            parts.push(num & 0xff)
            num = num >> 8
        }
        return new Uint8Array(parts.reverse());
    }

    function strToBuffer(str) {
// return new Blob([str]);

        var arr = new Uint8Array(str.length);
        for (var i = 0; i < str.length; i++) {
            arr[i] = str.charCodeAt(i)
        }
        return arr;
        // this is slower
        // return new Uint8Array(str.split('').map(function(e){
        // 	return e.charCodeAt(0)
        // }))
    }


//sorry this is ugly, and sort of hard to understand exactly why this was done
// at all really, but the reason is that there's some code below that i dont really
// feel like understanding, and this is easier than using my brain.

    function bitsToBuffer(bits) {
        var data = [];
        var pad = (bits.length % 8) ? (new Array(1 + 8 - (bits.length % 8))).join('0') : '';
        bits = pad + bits;
        for (var i = 0; i < bits.length; i += 8) {
            data.push(parseInt(bits.substr(i, 8), 2))
        }
        return new Uint8Array(data);
    }

    function generateEBML(json, outputAsArray) {
        var ebml = [];
        for (var i = 0; i < json.length; i++) {
            var data = json[i].data;
            if (typeof data == 'object')
                data = generateEBML(data, outputAsArray);
            if (typeof data == 'number')
                data = bitsToBuffer(data.toString(2));
            if (typeof data == 'string')
                data = strToBuffer(data);
            if (data.length) {
                var z = z;
            }

            var len = data.size || data.byteLength || data.length;
            var zeroes = Math.ceil(Math.ceil(Math.log(len) / Math.log(2)) / 8);
            var size_str = len.toString(2);
            var padded = (new Array((zeroes * 7 + 7 + 1) - size_str.length)).join('0') + size_str;
            var size = (new Array(zeroes)).join('0') + '1' + padded;
            //i actually dont quite understand what went on up there, so I'm not really
            //going to fix this, i'm probably just going to write some hacky thing which
            //converts that string into a buffer-esque thing

            ebml.push(numToBuffer(json[i].id));
            ebml.push(bitsToBuffer(size));
            ebml.push(data)


        }

//output as blob or byteArray
        if (outputAsArray) {
//convert ebml to an array
            var buffer = toFlatArray(ebml)
            return new Uint8Array(buffer);
        } else {
            return new Blob(ebml, {type: "video/webm"});
        }
    }

    function toFlatArray(arr, outBuffer) {
        if (outBuffer == null) {
            outBuffer = [];
        }
        for (var i = 0; i < arr.length; i++) {
            if (typeof arr[i] == 'object') {
//an array
                toFlatArray(arr[i], outBuffer)
            } else {
//a simple element
                outBuffer.push(arr[i]);
            }
        }
        return outBuffer;
    }

//OKAY, so the following two functions are the string-based old stuff, the reason they're
//still sort of in here, is that they're actually faster than the new blob stuff because
//getAsFile isn't widely implemented, or at least, it doesn't work in chrome, which is the
// only browser which supports get as webp

//Converting between a string of 0010101001's and binary back and forth is probably inefficient
//TODO: get rid of this function
    function toBinStr_old(bits) {
        var data = '';
        var pad = (bits.length % 8) ? (new Array(1 + 8 - (bits.length % 8))).join('0') : '';
        bits = pad + bits;
        for (var i = 0; i < bits.length; i += 8) {
            data += String.fromCharCode(parseInt(bits.substr(i, 8), 2))
        }
        return data;
    }

    function generateEBML_old(json) {
        var ebml = '';
        for (var i = 0; i < json.length; i++) {
            var data = json[i].data;
            if (typeof data == 'object')
                data = generateEBML_old(data);
            if (typeof data == 'number')
                data = toBinStr_old(data.toString(2));
            var len = data.length;
            var zeroes = Math.ceil(Math.ceil(Math.log(len) / Math.log(2)) / 8);
            var size_str = len.toString(2);
            var padded = (new Array((zeroes * 7 + 7 + 1) - size_str.length)).join('0') + size_str;
            var size = (new Array(zeroes)).join('0') + '1' + padded;
            ebml += toBinStr_old(json[i].id.toString(2)) + toBinStr_old(size) + data;
        }
        return ebml;
    }

//woot, a function that's actually written for this project!
//this parses some json markup and makes it into that binary magic
//which can then get shoved into the matroska comtainer (peaceably)

    function makeSimpleBlock(data) {
        var flags = 0;
        if (data.keyframe)
            flags |= 128;
        if (data.invisible)
            flags |= 8;
        if (data.lacing)
            flags |= (data.lacing << 1);
        if (data.discardable)
            flags |= 1;
        if (data.trackNum > 127) {
            throw "TrackNumber > 127 not supported";
        }
        var out = [data.trackNum | 0x80, data.timecode >> 8, data.timecode & 0xff, flags].map(function(e) {
            return String.fromCharCode(e)
        }).join('') + data.frame;
        return out;
    }

// here's something else taken verbatim from weppy, awesome rite?

    function parseWebP(riff) {
        var VP8 = riff.RIFF[0].WEBP[0];
        var frame_start = VP8.indexOf('\x9d\x01\x2a'); //A VP8 keyframe starts with the 0x9d012a header
        for (var i = 0, c = []; i < 4; i++)
            c[i] = VP8.charCodeAt(frame_start + 3 + i);
        var width, horizontal_scale, height, vertical_scale, tmp;
        //the code below is literally copied verbatim from the bitstream spec
        tmp = (c[1] << 8) | c[0];
        width = tmp & 0x3FFF;
        horizontal_scale = tmp >> 14;
        tmp = (c[3] << 8) | c[2];
        height = tmp & 0x3FFF;
        vertical_scale = tmp >> 14;
        return {
            width: width,
            height: height,
            data: VP8,
            riff: riff
        };
    }

// i think i'm going off on a riff by pretending this is some known
// idiom which i'm making a casual and brilliant pun about, but since
// i can't find anything on google which conforms to this idiomatic
// usage, I'm assuming this is just a consequence of some psychotic
// break which makes me make up puns. well, enough riff-raff (aha a
// rescue of sorts), this function was ripped wholesale from weppy

    function parseRIFF(string) {
        var offset = 0;
        var chunks = {};
        while (offset < string.length) {
            var id = string.substr(offset, 4);
            var len = parseInt(string.substr(offset + 4, 4).split('').map(function(i) {
                var unpadded = i.charCodeAt(0).toString(2);
                return (new Array(8 - unpadded.length + 1)).join('0') + unpadded;
            }).join(''), 2);
            var data = string.substr(offset + 4 + 4, len);
            offset += 4 + 4 + len;
            chunks[id] = chunks[id] || [];
            if (id === 'RIFF' || id === 'LIST') {
                chunks[id].push(parseRIFF(data));
            } else {
                chunks[id].push(data);
            }
        }
        return chunks;
    }

// here's a little utility function that acts as a utility for other functions
// basically, the only purpose is for encoding "Duration", which is encoded as
// a double (considerably more difficult to encode than an integer)
    function doubleToString(num) {
        return [].slice.call(
                new Uint8Array(
                        (
                                new Float64Array([num]) //create a float64 array
                                ).buffer) //extract the array buffer
                , 0) // convert the Uint8Array into a regular array
                .map(function(e) { //since it's a regular array, we can now use map
                    return String.fromCharCode(e) // encode all the bytes individually
                })
                .reverse() //correct the byte endianness (assume it's little endian for now)
                .join('') // join the bytes in holy matrimony as a string
    }

//Straight from wikipedia... :D 
    function unsynchsafe(numb) {
        var out = 0, mask = 0x7F000000;
        while (mask) {
            out >>= 1;
            out |= numb & mask;
            mask >>= 8;
        }

        return out;
    }

    function toDecimal(blob) {
        var out = 0;
        for (var i = 0, cnt = blob.length; i < cnt; i++) {
            if (i !== 0) {
                out <<= 8;
            }
            out |= blob.slice(i, i + 1).charCodeAt(0);
        }
        return out;
    }

    function WhammyVideo(speed, quality) { // a more abstract-ish API
        this.frames = [];
        this.duration = 1000 / speed;
        this.quality = quality || 0.8;
        this.hasAudio = false;
        this.processedFrames = [];
        

    }

    WhammyVideo.prototype.add = function(frame, duration) {
        if (typeof duration !== 'undefined' && this.duration)
            throw "you can't pass a duration if the fps is set";
        if (typeof duration === 'undefined' && !this.duration)
            throw "if you don't have the fps set, you ned to have durations here."
        if ('canvas' in frame) { //CanvasRenderingContext2D
            frame = frame.canvas;
        }
        if ('toDataURL' in frame) {
            var snapshot = frame.toDataURL('image/webp', this.quality);
        } else if (typeof frame !== "string") {
            throw "frame must be a a HTMLCanvasElement, a CanvasRenderingContext2D or a DataURI formatted string"
        }
        if (!(/^data:image\/webp;base64,/ig).test(snapshot)) {
            throw "Browswer dosen't support webp";
        } else {
            this.frames.push({
                image: snapshot,
                duration: duration || this.duration
            });
        }
    };

    WhammyVideo.prototype.compile = function(callback, outputAsArray) {

      callback(new toWebM(this.frames.map(function(frame) {
        var webp = parseWebP(parseRIFF(atob(frame.image.slice(23))));
        webp.duration = frame.duration;
        return webp;
      }), outputAsArray, this.hasAudio, this.audio));
    };

    WhammyVideo.prototype.addAudio = function(audio){
      this.hasAudio = true;

      //parsing result stripping the id3 tag if present
      if (audio.slice(0, 3) === "ID3") {
        for (var i = 0, cnt = audio.length; i < cnt; i++) {
          if (toDecimal(audio.slice(i, i + 1)) === 255) {
            if (toDecimal(audio.slice(i + 1, i + 2)) >= 224) {
              break;
            }
          }
        } //the 10 more bits are the ID3 tag header size
        audio = audio.slice(i);
      }
      this.audio = audio;
    }


    
    /**
     * expose the methods of madness
     */
    return {
        Video: WhammyVideo,
        fromImageArray: function(images, fps, outputAsArray) {
            return toWebM(images.map(function(image) {
                var webp = parseWebP(parseRIFF(atob(image.slice(23))));
                webp.duration = 1000 / fps;
                return webp;
            }), outputAsArray);
        },
        toWebM: toWebM
    };
})();
