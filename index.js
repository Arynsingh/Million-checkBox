import http from "node:http";
//we are usingh http server cuz express do not allow 
import express from "express";
import path from 'node:path';
async function main(){
    const app = express();
    const server = http.createServer(app)
    const PORT = process.env.PORT ?? 8000;

    app.use(express.static(path.resolve('./public')));

    app.get('/health',(req,res)=>{
        res.json({healty : true})
    })

    server.listen(PORT,()=>{
        console.log(`server is running on http://localhost:${PORT}`);
    });

}
main();