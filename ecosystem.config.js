module.exports = {
  apps : [
    {
      name: 'mtpclient',
      script: 'src/index.js',
      max_memory_restart: '250M',
      node_args: '--max_old_space_size=8196',
      watch: false,
      watch_delay: 2000,
      ignore_watch : ["_authdata","logs", "node_modules"],
      watch_options: { "followSymlinks": false }
    }
  ]
};
