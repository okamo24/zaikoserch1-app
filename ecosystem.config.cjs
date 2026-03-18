module.exports = {
  apps: [
    {
      name: "kurapuro-web",
      cwd: "/var/www/kurapuro/web",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
