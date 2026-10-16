import http from "node:http";
//we are usingh http server cuz express do not allow 
import express from "express";


import path from 'node:path';
import {Server} from 'socket.io';

import {publisher , subscriber ,redis } from './redis-connection.js';

const CHECKBOX_SIZE = 100;
const CHECKBOX_STATE_KEY = 'checkbox-state';


const rateLimitingHashMap = new Map();




const PORT = process.env.PORT ?? 8000;


async function main(){
    const PORT = process.env.PORT ?? 8000;
    const app = express();
    const server = http.createServer(app)

    const io = new Server();
    io.attach(server);


    await subscriber.subscribe('internal-server:checkbox:change')
    subscriber.on('message',(channel,message)=>{
        if(channel == 'internal-server:checkbox:change' ){
        const {index,checked}= JSON.parse(message);
         
         io.emit('server:checkbox:change',{index,checked});
        }
    })

    
    //socket io handlers
    io.on('connection',(socket)=>{
        console.log(`socket connected`,{id : socket.id});
        socket.on('Client:checkbox:change',async (data)=>{
            console.log(`[socket: ${socket.id}]:client:checkbox:change`,data);

            const lastOperationTime = rateLimitingHashMap.get(socket.id);

            if(lastOperationTime){
                    const timeElapsed = Date.now() - lastOperationTime;
                    if(timeElapsed < 5.5 * 1000){
                        socket.emit('server:error',{error : 'Please wait'});
                        return
                    }
            }
            rateLimitingHashMap.set(socket.id,Date.now());
            


            const existingState = await redis.get(CHECKBOX_STATE_KEY)


            if(existingState){
                const remoteData = JSON.parse(existingState)
                remoteData[data.index] = data.checked;
                await redis.set(CHECKBOX_STATE_KEY,JSON.stringify(remoteData));
            }else{
                await redis.set(
                    CHECKBOX_STATE_KEY,
                    JSON.stringify(new Array(CHECKBOX_SIZE).fill(false)),
                );
            }
           
            await publisher.publish('internal-server:checkbox:change',
                JSON.stringify(data),
            ) ;         
        });
    });

    //express
    app.use(express.static(path.resolve('./public')));
    app.get('/health',(req,res)=>{
        res.json({healty : true})
    })


    //api
    app.get('/checkboxes', async (req,res)=>{
         const existingState = await redis.get(CHECKBOX_STATE_KEY)
        if(existingState){
            const remoteData = JSON.parse(existingState);
            return res.json({checkboxes : remoteData})
        }
        return res.json({checkboxes :new Array(CHECKBOX_SIZE).fill(false)});
    })

    server.listen(PORT,()=>{
        console.log(`server is running on http://localhost:${PORT}`);
    });

}
main();