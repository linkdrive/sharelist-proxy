const http = require('http')
const https = require('https')
const axios = require('axios')

const utils = {
  getRange(r, total) {
    if (!r) return [0, total - 1]
    let [, start, end] = r.match(/(\d*)-(\d*)/) || [];
    start = start ? parseInt(start) : 0
    end = end ? parseInt(end) : total - 1
    return [start, end]
  },
  notfound(res) {
    res.statusCode = 404
    res.end('404 Not Found')
  },
  setHeaders(res,props){
    for(let key in props){
      res.setHeader(key,props[key])
    }
  },
  filterHeaders(pre = {}){
    const exclude = ['host','accept-encoding']
    let headers = {}
    for(let key in pre){
      if(exclude.includes(key) == false){
        headers[key] = pre[key]
      }
    }
    return headers
  }
}

const pipe = (client, server) => {
  const onClose = err => {
    client.destroy();
    server.destroy();
  };
  const onError = err => {
    //console.log(err);
  };

  client.pipe(server)

  server.on('close', onClose);
  server.on('error', onError);
  client.on('close', onClose);
  client.on('error', onError);
}


const cli = (defaultOptions = {}) => {
  let options = {}
  let _cli = {
    option(flags,desc){
      if(!Array.isArray(flags)){
        flags = [flags]
      }
      for(let key of flags){
        options[key] = desc
      }
      return _cli
    },
    parse(argv){
      let args = argv.slice(2)
      let i = 0, collection = {}
      while(i < args.length){
        let key = args[i]
        if( key.startsWith('-')){
          let next = args[i+1]
          if( next && !next.startsWith('-')){
            collection[key] = next
            i++
          }
        }
        i++
      }
      
      let ret = {...defaultOptions}
      for(let key in options){
        let para = options[key]
        let propName = para.prop
        if(collection[key]){
          ret[propName] = collection[key]
        }else{
          if(!ret[propName] && para.required ){
            console.log(`${para.help} is required.`)
            process.exit(1)
          }
        }
      }
      return ret
    }
  }
  return _cli
}


const config = cli({port: 33009 })
.option(['-p', '--port'], {prop: 'port', help: 'server port'})
.option(['-h', '--host'], {prop: 'host', required:true, help: 'sharelist server host'})
.option(['-t', '--token'], {prop: 'token', required:true, help: 'sharelist token'})
.parse(process.argv)

const TOKEN = config.token
const HOST = config.host 

const agent = new https.Agent({  
  rejectUnauthorized: false
})

let server = http.createServer(async (req, res) => {
  let reqHeaders = utils.filterHeaders(req.headers)

  let pathname = req.url
  console.log('-->',pathname)
  let resp
  try {
    resp = await axios.get(`${HOST}${pathname}?forward=1&token=${TOKEN}`,{
      headers:{
        'x-token':TOKEN
      }
    })
  } catch (e) {
    return utils.notfound(res)
  }
  if (resp.status == 200) {
    let { url, headers = {}, size, error } = resp.data
    if (error) {
      return utils.notfound(res)
    }
    let resHeaders = {},
      status = 200

    if (size) {
      resHeaders['accept-ranges'] = 'bytes'

      if (reqHeaders.range) {
        let [start, end] = utils.getRange(reqHeaders.range, size)
        resHeaders['content-range'] = `bytes ${start}-${end}/${size}`
        size = end - start + 1
        status = 206
      } 
      resHeaders['content-length'] = size
    }
    try {
      let output = await axios.get(url, { headers:{ ...reqHeaders, ...headers}, 
        responseType: 'stream' ,
        httpsAgent: agent
      })
      res.statusCode = status
      utils.setHeaders(res,{...output.headers, ...resHeaders})
      pipe(output.data, res)
    } catch (e) {
      // console.log(e)
      res.statusCode = e.response ? e.response.status : 500
      res.end()
    }

  } else {
    return utils.notfound(res)
  }

})

server.listen(config.port , () => {
  console.log('ShareList Proxy is running at 0.0.0.0:'+config.port)
})