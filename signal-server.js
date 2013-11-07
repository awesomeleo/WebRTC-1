var static = require('node-static');
var http = require('http');
var file = new(static.Server)();
var app = http.createServer(function (req, res) {
    file.serve(req, res);
}).listen(2013);

var io = require('socket.io').listen(app);
var global_client_id=0;
var client_list=[];



io.sockets.on('connection', function (socket){

    function log(){
        var array = [">>> Message from server: "];
        for (var i = 0; i < arguments.length; i++) {
            array.push(arguments[i]);
        }
        socket.emit('log', array);
    }


    function join(message)
    {




        global_client_id++;

        socket.resources.name=message;
        socket.resources.client_id=global_client_id;
        socket.resources.address=socket.handshake.address;
        socket.resources.socket_id=socket.id;
        socket.resources.status='idle';
        console.log("A client joined: ",socket.resources.name);
        console.log("with id ",socket.resources.client_id);
        console.log("From address ",socket.resources.address);


        //send the client a joined reponse
        socket.emit('joined',global_client_id);

        //send a list of existing clients to newly joined clients

      //  var send_client_list=client_list;
       // for(var i=0;i<send_client_list.length;i++)
       // {
       //       delete send_client_list[i]['socket_id'];
       //       delete send_client_list[i]['socket'];
       // }

        socket.emit('client list',client_list);

        var new_client={};
        new_client.id=socket.resources.client_id;
        new_client.name=socket.resources.name;
        new_client.socket_id=socket.id;
        new_client.address=socket.resources.address.address;
        new_client.status=socket.resources.status;
        //new_client.socket=socket;

        client_list.push(new_client);
        //send the new client to existing clients

       // delete new_client['socket_id'];
       // delete new_client['socket'];
        socket.broadcast.emit('client join',new_client);



    }


    function leave()
    {


        var index=-1;
        var client_id=-1;
        for(var i=0;i<client_list.length;i++)
        {
            if(client_list[i].socket_id==socket.id)
            {
                index=i;
                client_id=client_list[i].id;
                break;

            }
        }

        if(index==-1)
        {
        console.log("Error, Client ",socket.resources.client_id," wants to leave, but not in the client list!");
        return;
        }



        client_list.splice(index,1);
        socket.broadcast.emit('client leave',client_id);


        //tell the client that he has left
        socket.emit('left');



    }

    function onMessage(message)
    {
        console.log("Got Message from client ",socket.resources.client_id);
        console.log("The message is of type "+message.type);
        if(message.type=='broadcast')
        socket.broadcast.emit('message',message);
        else if(message.type=='peer')
        {
            var peer_id=message.to;
            var socket_id=-1;

            console.log("the message is to client "+peer_id);

            for(var i=0;i<client_list.length;i++)
            {
                   if(client_list[i].id==peer_id)
                   {


                   socket_id=client_list[i].socket_id;
                       console.log("peer id is found with socket id "+socket_id);
                   break;
                   }

            }


            if(socket_id==-1)
            return;

                console.log("message to client "+peer_id+" is sent!");
                io.sockets.sockets[socket_id].emit('message',message);


        }
    }

    function disconnect()
    {
        //first check if client leaves
        var index=-1;
        var client_id=-1;
        for(var i=0;i<client_list.length;i++)
        {
            if(client_list[i].socket_id==socket.id)
            {
                index=i;
                client_id=client_list[i].id;
                break;
            }
        }

        if(index==-1)
        return;

        //client fails to leave before disconnect
        client_list.splice(index,1);
        socket.broadcast.emit('client leave',client_id);

    }



    socket.resources={
        video:false,
        audio:false,
        screen:false,
        name:null,
        id:null,
        address:null,
        socket_id:null,
        status:null

    }


    console.log("client is connected!");


    socket.on('join',join);

    socket.on('leave',leave);

    socket.on('disconnect',disconnect);

    socket.on('message',onMessage);

    socket.on('status',onStatusUpdate);


    function onStatusUpdate(message)
    {
        var status=message;
        var index=-1;
        var client_id=null;

        for(var i=0;i<client_list.length;i++)
        {
            if(client_list[i].socket_id==socket.id)
            {
                index=i;
                client_id=client_list[i].id;
                break;

            }
        }

        if(index==-1)
        return;

        if(client_list[index].status!=status)
        {
           //update status
            client_list[index].status=status;

            socket.broadcast.emit('client status',client_id,status);

        }

    }





});

