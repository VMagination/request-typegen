#!/usr/bin/env node

const { program } = require('commander');
const http = require('http');
const fs = require('fs');
const url = require('url');
const path = require('path');
const os = require('os');

program
  .command('start')
  .option('-p, --port <port>', 'Port to start the server on', '4832')
  .description('Start the Node.js server')
  .action((port) => {
    const server = http.createServer((req, res) => {
      try {
        const urlObj = url.parse(req.url, true);
        if (urlObj.pathname === '/readFile' && req.method === 'GET') {
          const urlObj = url.parse(req.url, true);
          const name = urlObj.query?.fileName;
          if (!name) {
            res.statusCode = 400;
            res.end('File name is required');
            return;
          }
          const filePath = path.join(process.cwd(), name);

          fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
              res.statusCode = 404;
              res.end('File not found');
            } else {
              fs.readFile(filePath, (err, data) => {
                if (err) {
                  res.statusCode = 500;
                  res.end('Error reading file');
                } else {
                  res.setHeader('Content-Type', 'text/plain');
                  res.end(data);
                }
                console.log(`Reading file ${name} ${err ? 'failed' : ''}`);
              });
            }
          });
          return;
        }

        if (urlObj.pathname === '/fileExists' && req.method === 'GET') {
          const name = urlObj.query?.fileName;
          if (!name) {
            res.statusCode = 400;
            res.end('File name is required');
            return;
          }

          const filePath = path.join(process.cwd(), name);
          fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
              res.statusCode = 404;
              res.end('File not found');
            } else {
              res.setHeader('Content-Type', 'text/plain');
              res.end('success');
            }
            console.log(`File ${name} ${err ? 'not found' : 'found'}`);
          });
          return;
        }
        if (urlObj.pathname === '/writeFile' && req.method === 'POST') {
          const name = urlObj.query?.fileName;
          console.log({name});
          if (!name) {
            res.statusCode = 400;
            res.end('File name is required');
            return;
          }
          const filePath = path.join(process.cwd(), name);
          let body = '';

          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', () => {
            fs.writeFile(filePath, body, (err) => {
              if (err) {
                res.statusCode = 500;
                res.end('Error writing file');
              } else {
                res.setHeader('Content-Type', 'text/plain');
                res.end('success');
              }
              console.log(`Writing file ${name} ${err ? 'failed' : ''}`);
            });

          });
          return;
        }

        res.statusCode = 404;
        res.end();
      } catch (err) {
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });

    server.listen(port || 4832, () => {
      const address = server.address();
      const interfaces = os.networkInterfaces();
      const ips = Object.values(interfaces)
        .flat()
        .filter((i) => i.family === 'IPv4' && !i.internal);
      ips.forEach((ip) => {
        const serverUrl = `http://${ip.address}:${address.port}`;
        console.log('Server started on (networks):', serverUrl);
      })
      console.log('Server started on (localhost):', `http://localhost:${address.port}`);
    });
  });

program.parse(process.argv);
