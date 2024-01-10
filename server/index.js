import express from "express";
import logger from "morgan"
import {Server} from "socket.io"
import { createServer } from "node:http";
import dotenv from 'dotenv'
import {createClient} from "@libsql/client"
const port = process.env.PORT ?? 1234
dotenv.config()
const app = express()
const server = createServer(app)
const io = new Server(server,{
    connectionStateRecovery:{}
})
const db = createClient({
    url:"libsql://aware-magma-juandavision1.turso.io",
    authToken: process.env.DB_TOKEN
})

await db.execute(`
CREATE TABLE IF NOT EXISTS messages(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
)
`)
io.on('connection',async(socket)=>{
    console.log('New conection created')
    socket.on('disconnect',()=>{
        console.log('User disconected')
    })
    
    socket.on('chat message',async(msg)  =>{
        let result
        const username = socket.handshake.auth.username ?? 'anonimous'

         try{
             result = await db.execute({
                sql:`INSERT INTO messages (content,user) VALUES (:msg, :username)`,
                args:{msg,username}
             })
       } catch (error) {
        console.error(error)
       }
       
       io.emit('chat message',msg,result.lastInsertRowid.toString(),username)
    })
    
    if(!socket.recovered){
        try {
            const result = await db.execute({
                sql:'SELECT id,content,user from messages WHERE id  > ?',
                args:[socket.handshake.auth.serverOffset ?? 0]
            })
            result.rows.forEach(row=>{
               socket.emit('chat message',row.content, row.id.toString(),row.user) 
            })
        } catch (error) {
            console.log(error)
        }
    }
})

app.use(logger('dev'))
app.get('/',(req,res)=>{
    res.sendFile(process.cwd()+'/client/index.html')

})
server.listen(port,()=>{
    console.log('Port',port)
})