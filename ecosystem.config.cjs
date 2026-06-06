module.exports = {
  apps: [
    {
      name: "madu-ai-whatsapp-assistant",
      script: "server/index.js",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
