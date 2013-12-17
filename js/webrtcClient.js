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

       this.heartbeatInterval=10;


       this.loginCallback=null;
       this.disconnectCallback=null;
       this.callbackEntity=null;
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
         this.loginCallback.apply(this.callbackEntity);

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
}

WEBRTCClient.prototype.processPeerMsg=function(json)
{

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


WEBRTCClient.prototype.startHeatBeat=function()
{


   this.stopHeartBeat();
   var that=this;
   this.heartbeatID=setInterval(function(){ that.sendHeartBeatMsg.call(that)},
       this.heartbeatInterval*1000);
}


WEBRTCClient.prototype.stopHeartBeat=function()
{
    if(this.heartbeatID!=null)
    {
        clearInterval(this.heartbeatID);
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
           that.isConnected=false;
           that.connectionstate=ClientState.OFFLINE;

           if(that.disconnectCallback!=null)
            that.disconnectCallback.apply(that.callbackEntity);


       }

       this.websocket.onmessage=function(evt){

           console.log("received message: "+evt.data);

           that.processMessage(evt.data);

       }
}



