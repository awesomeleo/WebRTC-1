'use strict';

var constraints = {video:true,audio:true};
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

var localStream;
var remoteStream;
var pc;


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
    localStream = stream;
    attachMediaStream(localVideo, stream);
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

function SendBroadcastMessage(message)
{
       var msg={};
       msg.type='broadcast'
       msg.from=global_client_id;
       msg.msg=message;

       client_socket.emit('message',msg);

}

function SendPeerMessage(message,peer_id)
{
       var msg={};
       msg.type='peer';
       msg.from=global_client_id;
       msg.to=peer_id;
       msg.msg=message;
       client_socket.emit('message',msg);

       console.log("send client "+peer_id+ " a message of type "+message.type);
}


function SendStatusMessage(message)
{
    client_socket.emit('status',message);
}


function handleIceCandidate(event) {
    console.log('handleIceCandidate event: ', event);
    if (event.candidate) {

        var message={
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate};

     SendPeerMessage(message,global_peer_id);
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
}

function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}


function setLocalAndSendMessage(sessionDescription) {
    // Set Opus as the preferred codec in SDP if Opus is present.
    sessionDescription.sdp = preferOpus(sessionDescription.sdp);
    pc.setLocalDescription(sessionDescription);
    SendPeerMessage(sessionDescription,global_peer_id);
}


function MaybeStart()
{
    if (!isStarted && localStream)
    {
        createPeerConnection();
        pc.addStream(localStream);
        isStarted = true;

        var stopcall_button=document.getElementById('StopCall');
        stopcall_button.disabled=false;

        SendStatusMessage('busy');

        if (isInitiator) {
            doCall();
        }
    }
}

function doCall()
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


function doAnswer() {
    console.log('Sending answer to peer.');
    pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
}


function hangup() {
    console.log('Hanging up.');
    stop();
    SendPeerMessage('bye',global_peer_id);
}

function handleRemoteHangup() {
    console.log('Session terminated.');
    stop();
    isInitiator = false;


    var stopcall_button=document.getElementById('StopCall');
    stopcall_button.disabled=true;




}

function stop() {
    isStarted = false;
    // isAudioMuted = false;
    // isVideoMuted = false;
    pc.close();
    pc = null;

    StopRemoteMedia();

    SendStatusMessage('idle');
}

