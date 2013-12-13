/**
 * Created with IntelliJ IDEA.
 * User: haiyang
 * Date: 12/13/13
 * Time: 5:07 PM
 * To change this template use File | Settings | File Templates.
 */

function Peer()
{
    this.id=-1;
    this.status="idle";
    this.udpEnabled=false;
    this.platform="unknown";
    this.name=null;
}

 function webrtcClient( name, ServerAddress)
{
       this.name=name;
       this.ServerAddress=ServerAddress;
       this.socket=null;
       this.isConnected=false;
       this.id=-1;
}


webrtcClient.prototype.setID=function(id)
{
       this.id=id;
}
