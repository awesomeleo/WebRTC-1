/**
 * Created by haiyang on 12/19/13.
 */
'use strict';
var audio_constraints = {
    mandatory: {
        'googEchoCancellation': false,
        'googNoiseSuppression': false
    },
    optional: []
};

var video_constraints_ld = {
    mandatory: {
        maxWidth:320,
        maxHeight:240
    },
    optional: []
};

var video_constraints_sd = {
    mandatory: {
        maxWidth:480,
        maxHeight:320
    },
    optional: []
};

var video_constraints_hd = {
    mandatory: {
        maxWidth:640,
        maxHeight:480
    },
    optional: []
};

var currentVideoConstraint=video_constraints_ld;

var constraints = {audio:audio_constraints,video:currentVideoConstraint};

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

var localStream=null;
var remoteStream=null;
var pc=null;

var isInitiator=false;
var isStarted=false;

var webrtcClient=null;


var pc_config =
{'iceServers': [{'url': 'stun:129.249.49.99:19200'}]};

var pc_constraints = {
    'optional': [
        {'DtlsSrtpKeyAgreement': true},
        {'RtpDataChannels': true}
    ]};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
    'OfferToReceiveAudio':true,
    'OfferToReceiveVideo':true }};


function handleUserMedia(stream) {


    //add audio support
    //create an audio context
    var audioContext = window.AudioContext || window.webkitAudioContext;


    /*
     if(audioContext)
     {

     var context = new audioContext();
     var microphone=context.createMediaStreamSource(stream);

     var volume=context.createGain();
     volume.gain.value=0.5;

     var destination = context.createMediaStreamDestination();
     var outputStream=destination.stream;

     microphone.connect(volume);
     volume.connect(destination);

     stream.removeTrack(stream.getAudioTracks()[0]);

     stream.addTrack(outputStream.getAudioTracks()[0]);



     }
     */


    localStream = stream;
    attachLocalMediaStream(localVideo, stream);
    console.log('Adding local stream.');
    //sendMessage('got user media');


}


function StopLocalMedia()
{
    detachMediaStream(localVideo,localStream);

    console.log("detached local media stream");

}


function StopRemoteMedia()
{
    detachMediaStream(remoteVideo,remoteStream);

    console.log("detached remote media stream");
}

function handleUserMediaError(error){
    console.log('navigator.getUserMedia error: ', error);
}

function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(pc_config, pc_constraints);
        pc.onicecandidate = handleIceCandidate;
        console.log('Created RTCPeerConnnection with:\n' +
            '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
            '  constraints: \'' + JSON.stringify(pc_constraints) + '\'.');
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;


    /*
     if (isInitiator) {
     try {
     // Reliable Data Channels not yet supported in Chrome
     sendChannel = pc.createDataChannel("sendDataChannel",
     {reliable: false});
     trace('Created send data channel');
     } catch (e) {
     alert('Failed to create data channel. ' +
     'You need Chrome M25 or later with RtpDataChannel enabled');
     trace('createDataChannel() failed with exception: ' + e.message);
     }
     sendChannel.onopen = handleSendChannelStateChange;
     sendChannel.onclose = handleSendChannelStateChange;
     } else {
     pc.ondatachannel = gotReceiveChannel;
     }
     */
}



function SendPeerRTCMessage(message)
{

    webrtcClient.sendWebRTCMessage(message);


    console.log("send  a message of type "+message.type);
}





function handleIceCandidate(event) {
    console.log('handleIceCandidate event: ', event);
    if (event.candidate) {

        var message={
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate};

        SendPeerRTCMessage(message);
    } else {
        console.log('End of candidates.');
    }
}


function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
//  reattachMediaStream(miniVideo, localVideo);
    attachMediaStream(remoteVideo, event.stream);
    remoteStream = event.stream;
//  waitForRemoteVideo();

    webrtcClient.callEstablishedCallback();
}

function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}


function setLocalAndSendMessage(sessionDescription) {
    // Set Opus as the preferred codec in SDP if Opus is present.
    sessionDescription.sdp = maybePreferAudioReceiveCodec(sessionDescription.sdp);
    pc.setLocalDescription(sessionDescription);
    SendPeerRTCMessage(sessionDescription);
}




function maybePreferAudioSendCodec(sdp) {
    if (audio_send_codec == '') {
        console.log('No preference on audio send codec.');
        return sdp;
    }
    console.log('Prefer audio send codec: ' + audio_send_codec);
    return preferAudioCodec(sdp, audio_send_codec);
}

function maybePreferAudioReceiveCodec(sdp) {
    if (audio_receive_codec == '') {
        console.log('No preference on audio receive codec.');
        return sdp;
    }
    console.log('Prefer audio receive codec: ' + audio_receive_codec);
    return preferAudioCodec(sdp, audio_receive_codec);
}




// Set |codec| as the default audio codec if it's present.
// The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
function preferAudioCodec(sdp, codec) {
    var fields = codec.split('/');
    if (fields.length != 2) {
        console.log('Invalid codec setting: ' + codec);
        return sdp;
    }
    var name = fields[0];
    var rate = fields[1];
    var sdpLines = sdp.split('\r\n');

    // Search for m line.
    for (var i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('m=audio') !== -1) {
            var mLineIndex = i;
            break;
        }
    }
    if (mLineIndex === null)
        return sdp;

    // If the codec is available, set it as the default in m line.
    for (var i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search(name + '/' + rate) !== -1) {
            var regexp = new RegExp(':(\\d+) ' + name + '\\/' + rate, 'i');
            var payload = extractSdp(sdpLines[i], regexp);
            if (payload)
                sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
                    payload);
            break;
        }
    }

    // Remove CN in m line and sdp.
    sdpLines = removeCN(sdpLines, mLineIndex);

    sdp = sdpLines.join('\r\n');
    return sdp;
}


function WebRTCMaybeStart()
{
    if (!isStarted && localStream)
    {
        createPeerConnection();
        pc.addStream(localStream);
        isStarted = true;



        if (isInitiator) {
            WebRTCdoCall();
        }
    }
}

function WebRTCdoCall()
{

    var constraints = {'optional': [], 'mandatory': {'MozDontOfferDataChannel': true}};
    // temporary measure to remove Moz* constraints in Chrome
    if (webrtcDetectedBrowser === 'chrome') {
        for (var prop in constraints.mandatory) {
            if (prop.indexOf('Moz') !== -1) {
                delete constraints.mandatory[prop];
            }
        }
    }
    constraints = mergeConstraints(constraints, sdpConstraints);
    console.log('Sending offer to peer, with constraints: \n' +
        '  \'' + JSON.stringify(constraints) + '\'.');
    pc.createOffer(setLocalAndSendMessage, null, constraints);

}


function WebRTCdoAnswer() {
    console.log('Sending answer to peer.');
    pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
}


/*
function hangup() {
    console.log('Hanging up.');
    stop();
    SendPeerMessage('bye',global_peer_id);
}
*/


/*
function handleRemoteHangup() {
    console.log('Session terminated.');
    stop();
    isInitiator = false;


    var stopcall_button=document.getElementById('StopCall');
    stopcall_button.disabled=true;




}
*/

function stopWebRTCMedia() {
    isStarted = false;
    isInitiator=false;
    // isAudioMuted = false;
    // isVideoMuted = false;
    pc.close();


    StopRemoteMedia();

    pc=null;


}

