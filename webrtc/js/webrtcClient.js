/**
 * Created with IntelliJ IDEA.
 * User: haiyang
 * Date: 12/13/13
 * Time: 5:07 PM
 * To change this template use File | Settings | File Templates.
 */

var ClientState ={
      OFFLINE: {value:0, string:"offline"},
      CONNECTED: {value:1, string: "connected"},
      LOGGEDIN: {value:2, string: "logged in"}
}


function Peer()
{
    this.id=-1;
    this.status="idle";
    this.udp=false;
    this.platform="unknown";
    this.name=null;
}




 function WEBRTCClient(name, ServerAddress)
{
       this.name=name;
       this.ServerAddress=ServerAddress;
       this.socket=null;
       this.connectionstate=ClientState.OFFLINE;
       this.id=-1;
       this.websocket=null;
       this.status="idle";
       this.platform="web";
       this.udpEnabled="false";
       this.peers=null;
       this.shouldLogin=true;


       this.heartbeatID=null;

       this.LoginTimerID=null;
       this.LogoutTimerID=null;

       this.currentPeerName=null;
       this.currentPeerID=null;

       this.heartbeatInterval=5;


       this.loginCallback=null;
       this.disconnectCallback=null;
       this.callbackEntity=null;

       this.addPeerCallback=null;
       this.removePeerCallback=null;
       this.changePeerStatusCallback=null;


       this.invitationReceivedCallback=null;

       this.invitationAcceptedCallback=null;

       this.invitationDeclinedCallback=null;

       this.callFinishCallback=null;

       this.webrtcMessageCallback=null;

       this.callEstablishedCallback=null;

       this.sendWebRTCMessageCallback=null;


}


WEBRTCClient.prototype.close=function()
{
    if(this.connectionstate==ClientState.OFFLINE)
    return;

    this.websocket.close();
}

WEBRTCClient.prototype.processMessage=function(msg)
{
      var json=JSON.parse(msg);
      if(json.hasOwnProperty("action")==false)
      {
          console.log("error in parsing message from server!");
          return;
      }

      var action=json.action;
      if(action=="login")
      {
         this.id=json.id;

         this.peers={};
         this.connectionstate=ClientState.LOGGEDIN;

         this.startHeatBeat();

         console.log("successfully logged in with id: "+this.id);

         if(this.loginCallback!=null)
         this.loginCallback.call(this.callbackEntity);

         return;
      }

      else if(action=="logout")
      {


          this.stopHeartBeat();

          this.connectionstate=ClientState.CONNECTED;

          this.close();



          return;

      }
      else if(action=="peer_login")
      {
          this.addPeer(json);


          return;
      }
      else if(action=="peer_logout")
      {
          this.removePeer(json);
          return;
      }
      else if(action=="peer_status_update")
      {
          this.updatePeerStatus(json);
          return;
      }
      else if(action=="peer_online")
      {
          this.addPeer(json);
          return;
      }
      else if(action=="peer_msg")
      {
          this.processPeerMsg(json);
          return;
      }

}


WEBRTCClient.prototype.addPeer=function(json)
{
          var peer_id=json.id;
          if(this.peers.hasOwnProperty(peer_id))
          {
              console.log("error adding peer "+peer_id+"! Already exits");
              return;

          }

          var peer_contents=new Peer();
          peer_contents.id=peer_id;
          peer_contents.name=json.name;
          peer_contents.status=json.status;
          peer_contents.platform=json.platform;
          peer_contents.udp=json.udp;


          this.peers[peer_id]=peer_contents;


          if(this.addPeerCallback!=null)
          this.addPeerCallback.call(this.callbackEntity,peer_contents);

}

WEBRTCClient.prototype.removePeer=function(json)
{
          var peer_id=json.id;
          if(!this.peers.hasOwnProperty(peer_id))
          {
              console.log("error removing peer "+peer_id+"! Not existent");
              return;
          }

          delete this.peers[peer_id];

          if(this.removePeerCallback!=null)
          this.removePeerCallback.call(this.callbackEntity,peer_id);
}

WEBRTCClient.prototype.updatePeerStatus=function(json)
{
          var peer_id=json.id;
          if(!this.peers.hasOwnProperty(peer_id))
          {
           console.log("error updating status for peer "+peer_id+"! Not existent");
           return;
          }



          this.peers[peer_id].status=json.status;


          if(this.changePeerStatusCallback!=null)
          this.changePeerStatusCallback.call(this.callbackEntity,peer_id,json.status);
}

WEBRTCClient.prototype.processPeerMsg=function(json)
{
           var msg=json.msg;
           var PeerID=json.from;
           var PeerName=this.peers[PeerID].name;

           if(msg=="invite")
           {
               if(this.status=="busy")
               this.declineCall(PeerID);
               else
               {
                   if(this.invitationReceivedCallback!=null)
                   {
                       this.invitationReceivedCallback.call(this.callbackEntity,PeerID,PeerName);
                   }
                   else
                   {
                       this.declineCall(PeerID);
                   }
               }
           }
           else if(msg=="invite_ok")
           {

                this.currentPeerName=PeerName;
                this.currentPeerID=PeerID;

                if(this.invitationAcceptedCallback!=null)
                {
                    this.invitationAcceptedCallback.call(this.callbackEntity,PeerName);
                }

           }
           else if(msg=="invite_decline")
           {
                var Reason=json.reason;


                this.updateStatus("idle");

               if(this.invitationDeclinedCallback!=null)
               {

                   this.invitationDeclinedCallback.call(this.callbackEntity,PeerName,Reason);
               }
           }
           else if(msg=="finish")
           {

                this.updateStatus("idle");

                this.currentPeerID=null;
                this.currentPeerName=null;

                 if(this.callFinishCallback!=null)
                 {
                     this.callFinishCallback.call(this.callbackEntity);
                 }
           }

           else if(msg=="webrtc")
           {
               if(this.webrtcMessageCallback!=null)
               {
                   this.webrtcMessageCallback.call(this.callbackEntity,json.contents);
               }
           }

}


WEBRTCClient.prototype.restoreState=function()
{
    //clear various states
    this.id=-1;
    this.connectionstate=ClientState.CONNECTED;
    this.peers=null;
    this.status="idle";
}


WEBRTCClient.prototype.sendHeartBeatMsg=function()
{
    var json={};
    json.action="heartbeat";
    json.id=this.id;

    var message=JSON.stringify(json);



    if(this.sendMessage(message)!=true)
    {
        console.log("error sending heartbeat!");
    }


}

WEBRTCClient.prototype.callPeer=function(PeerID)
{
      this.updateStatus("busy");

      var json={};
      json.action="peer_msg";
      json.from=this.id;
      json.to=PeerID;
      json.msg="invite";

      var message=JSON.stringify(json);

      if(this.sendMessage(message)!=true)
      {
        console.log("error sending invitation to peer!");
          return;
      }

      console.log("invitation message is sent: "+message);
}

WEBRTCClient.prototype.acceptCall=function(PeerID)
{
      this.updateStatus("busy");

      var json={};
      json.action="peer_msg";
      json.from=this.id;
      json.to=PeerID;
      json.msg="invite_ok";

      var message=JSON.stringify(json);

      if(this.sendMessage(message)!=true)
      {
        console.log("error accepting invitation from peer!");
          return;
      }


      this.currentPeerName=this.peers[PeerID].name;
      this.currentPeerID=PeerID;

      console.log("invitation acceptance message is sent: "+message);

}

WEBRTCClient.prototype.declineCall=function(PeerID)
{
      var json={};
      json.action="peer_msg";
      json.from=this.id;
      json.to=PeerID;
      json.msg="invite_decline";
      json.reason="busy";

      var message=JSON.stringify(json);

     if(this.sendMessage(message)!=true)
     {
        console.log("error declining invitation from peer!");
         return;
     }

     console.log("invitation declining message is sent: "+message);

}


WEBRTCClient.prototype.stopCall=function(PeerID)
{

    this.updateStatus("idle");


    var json={};
    json.action="peer_msg";
    json.from=this.id;
    json.to=PeerID;
    json.msg="finish";
    json.reason="finish";

    var message=JSON.stringify(json);

    if(this.sendMessage(message)!=true)
    {
        console.log("error sending finish message!");
        return;
    }

    console.log("finish message is sent: "+message);


    this.currentPeerID=null;
    this.currentPeerName=null;

}


WEBRTCClient.prototype.updateStatus=function(new_status)
{
      if(this.status==new_status)
      return;

      this.status=new_status;

      //send a notification to the server
      var json={};
      json.action="update_status";
      json.status=new_status;

      var message=JSON.stringify(json);

      if(this.sendMessage(message)!=true)
      {
        console.log("error updating status!");
          return;
      }

      console.log("status update message is sent: "+message);

}


WEBRTCClient.prototype.startHeatBeat=function()
{


   this.stopHeartBeat();
   var that=this;
   this.heartbeatID=setInterval(function(){ that.sendHeartBeatMsg.call(that)},
       this.heartbeatInterval*1000);
}

WEBRTCClient.prototype.OnLogoutTimeout=function()
{
      console.log("Logout request timeout");


      if(this.disconnectCallback!=null)
        this.disconnectCallback.call(this.callbackEntity);

}

WEBRTCClient.prototype.startLogoutTimer=function()
{
     this.stopLogoutTimer();

     var that=this;
     this.LogoutTimerID=setInterval(function(){
         that.OnLogoutTimeout.call(that)
     },5000);
}


WEBRTCClient.prototype.stopLogoutTimer=function()
{
     if(this.LogoutTimerID!=null)
     {
         clearInterval(this.LogoutTimerID);
         this.LogoutTimerID=null;
     }

}


WEBRTCClient.prototype.stopHeartBeat=function()
{
    if(this.heartbeatID!=null)
    {
        clearInterval(this.heartbeatID);
        this.heartbeatID=null;
    }
}


WEBRTCClient.prototype.Login=function()
{
    if(this.connectionstate==ClientState.LOGGEDIN)
    return;

    //construct a login request message
    var json={};
    json.action="login";
    json.name=this.name;
    json.platform=this.platform;
    json.udp=this.udpEnabled;

    //send message
    var message=JSON.stringify(json);


    if(this.sendMessage(message)!=true)
    {
        console.log("error login!");
    }

    console.log("login message is sent: "+message);
}


WEBRTCClient.prototype.Logout=function()
{

    if(this.connectionstate==ClientState.OFFLINE)
    return;


    this.startLogoutTimer();


    if(this.connectionstate==ClientState.CONNECTED)
    {
        this.close();
        return;
    }


    //construct a logout request message
    var json={};
    json.action="logout";
    json.id=this.id;

    //send message
    var message=JSON.stringify(json);

    if(this.sendMessage(message)!=true)
    {
        console.log("error logout!");
    }

    console.log("logout message is sent: "+message);
}


WEBRTCClient.prototype.sendMessage=function(msg)
{
    if(this.websocket==null || this.connectionstate==ClientState.OFFLINE )
    {
        console.log("error! not connected!");
        return false;
    }

    this.websocket.send(msg);


    console.log("message is sent: "+msg);
    return true;
}


WEBRTCClient.prototype.sendWebRTCMessage=function(msg)
{
    var json={};
    json.action="peer_msg";
    json.from=this.id;
    json.to=this.currentPeerID;
    json.msg="webrtc";
    json.contents=msg;

    //send message
    var message=JSON.stringify(json);


    if(this.sendMessage(message)!=true)
    {
        console.log("error sending webrtc message!");
        return;
    }

    if(this.sendWebRTCMessageCallback)
    {
        this.sendWebRTCMessageCallback(this.callbackEntity,msg);
    }

    console.log("webrtc message is sent: "+message);


}


WEBRTCClient.prototype.connect=function()
{
       if(this.connectionstate!=ClientState.OFFLINE)
       return;



       this.websocket=new WebSocket(this.ServerAddress);


       var that=this;
       this.websocket.onerror=function(evt){

           console.log("error during websocket connection!");
           that.websocket.close();
           that.isConnected=false;
           that.connectionstate=ClientState.OFFLINE;
       }

       this.websocket.onopen=function(evt){

           console.log("get connected to "+that.ServerAddress);
           that.isConnected=true;
           that.connectionstate=ClientState.CONNECTED;

           if(that.shouldLogin==true)
           {
              that.Login();
           }
       }

       this.websocket.onclose=function(evt){

           console.log("connection to server is closed");

           that.stopHeartBeat();

           that.stopLogoutTimer();
           that.isConnected=false;
           that.connectionstate=ClientState.OFFLINE;

           if(that.disconnectCallback!=null)
            that.disconnectCallback.call(that.callbackEntity);


       }

       this.websocket.onmessage=function(evt){

           console.log("received message: "+evt.data);

           that.processMessage(evt.data);

       }
}



