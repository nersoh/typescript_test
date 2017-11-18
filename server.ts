const pgPromise = require('pg-promise');
const R         = require('ramda');
const request   = require('request-promise');

// Limit the amount of debugging of SQL expressions
const trimLogsSize : number = 200;

// Database interface
interface DBOptions
  { host      : string
  , database  : string
  , user?     : string
  , password? : string
  , port?     : number
  };

// Actual database options
const options : DBOptions = {
  // user: ,
  // password: ,
  host: 'localhost',
  database: 'lovelystay_test',
};

console.info('Connecting to the database:',
  `${options.user}@${options.host}:${options.port}/${options.database}`);

const pgpDefaultConfig = {
  promiseLib: require('bluebird'),
  // Log all querys
  query(query) {
    console.log('[SQL   ]', R.take(trimLogsSize,query.query));
  },
  // On error, please show me the SQL
  error(err, e) {
    if (e.query) {
      console.error('[SQL   ]', R.take(trimLogsSize,e.query),err);
    }
  }
};

interface GithubUsers
  { id : number,
    company: string,
    login: string,
    location: string,
    name: string,
  };

const pgp = pgPromise(pgpDefaultConfig);
const db = pgp(options);
let userName: string = '';

if (~process.argv.indexOf('--username')) {
  userName = process.argv[process.argv.indexOf('--username') + 1]
}

db.none('CREATE TABLE IF NOT EXISTS github_users (id BIGSERIAL UNIQUE, login TEXT, name TEXT, company TEXT, location TEXT)')
.then(() => request({
  uri: `https://api.github.com/users/${userName}`,
  headers: {
        'User-Agent': 'Request-Promise'
    },
  json: true
}))
.then((data: GithubUsers) => db.one(
  'INSERT INTO github_users (id, login, name, company, location) VALUES ($[id], $[login], $[name], $[company], $[location]) RETURNING id', data) 
)
.then(({id}) => console.log(id))
.catch(error => console.log(error.detail))
.then(() => {
  db.any('SELECT location, COUNT(*) AS total from github_users GROUP BY location ORDER BY total DESC, location ASC')
    .then((data: { location: string, count: number }) => usersPerLocationStats(data))
    .then(() => process.exit(0));
});

const usersPerLocationStats = (data) => {
  console.log('[USERS PER LOCATION   ]');
  data.forEach(item => console.log(item));
}