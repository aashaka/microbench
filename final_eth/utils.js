const benchmark =  require('benchmark');
const fs = require("fs-extra");
const path = require("path");
const Pick = require("stream-json/filters/Pick");
const RLP = require('rlp');
const streamChain = require("stream-chain");
const streamJson = require("stream-json");
const streamObject = require("stream-json/streamers/StreamObject");
const rainblock = require('@rainblock/merkle-patricia-tree');
const wait = require('wait-for-stuff');
const hashAsBuffer = require('bigint-hash').hashAsBuffer;
const HashType = require('bigint-hash').HashType;
const asyncChunks = require('async-chunks');
const ethUtil = require('ethereumjs-util');

module.exports = {
  ethAccountToRlp,
  newBenchmark,
  addAsyncTest,
  addTest,
  readStateDump,
  generateStandardTree,
  countNodes,
  readFixedFromDump
}

module.exports.startBlock = 100000;
module.exports.endBlock = 4000000;
module.exports.interval = 100000;
module.exports.skipBlocks = [2500000, 2600000, 2700000, 3000000];
module.exports.batchSize = [100, 500, 1000];
module.exports.maxRounds = 10;

function countNodes (node, number) {
  if (!node) {
    return;
  }
  if (node instanceof rainblock.LeafNode) {
    number.push('LN');
  }
  else if (node instanceof rainblock.ExtensionNode) {
    number.push('EN');
    countNodes(node.NextNode, number);
  }
  else if (node instanceof rainblock.BranchNode) {
   number.push('BN'); 
   for (let i = 0; i < node.branches.length; i++) {
     countNodes(node.branches[i], number);
   }
  }
}


function generateStandardTree (rounds) {
  let seed = Buffer.alloc(32, 0 + Math.floor(Math.random() * (9)));
  let batchOps = [];
  for (let i = 1; i <= rounds; i++) {
    seed = hashAsBuffer(HashType.KECCAK256, seed);
    batchOps.push({
      key: seed,
      val: hashAsBuffer(HashType.KECCAK256, seed),
      value: hashAsBuffer(HashType.KECCAK256, seed),
      type: 'put'
    });
  }
  return batchOps;
};

function ethAccountToRlp (account) {
  let hexBalance = BigInt(`${account.balance}`).toString(16);
  
  if (hexBalance === '0') {
      hexBalance = '';
  }
  else if (hexBalance.length % 2 === 1) {
      hexBalance = `0${hexBalance}`;
  }
  
  return RLP.encode([
      account.nonce,
      Buffer.from(hexBalance, 'hex'),
      Buffer.from(account.root, 'hex'),
      Buffer.from(account.codeHash, 'hex')
  ]);
}

function addAsyncTest (
  suite, name, asyncTest, setup, state, ...args) {

  suite.add(name, {
    defer: true,
    setup: () => {
      if (setup) {
        setup(state, ...args);
      }
    },
    fn: (deferred) => {
      asyncTest(state, ...args).then(() => deferred.resolve());
    }
  });
};

function addTest(
  suite, name, Test, setup, state, ...args) {
  suite.add(name, {
    defer: true,
    setup: () => {
      if (setup) {
        setup(state, ...args);
      }
    },
    fn: (deferred) => {
       Test(state, ...args);
       deferred.resolve();
    }
  });
};

function newBenchmark () {
  const suite = new benchmark.Suite();
  
  suite.on('cycle', (event) => {
    const benchmarkRun = event.target;
    const stats = benchmarkRun.stats;
    const meanInMillis = (stats.mean * 1000).toFixed(3);
    const stdDevInMillis = (stats.deviation * 1000).toFixed(4);
    const runs = stats.sample.length;
    const ops = benchmarkRun.hz.toFixed(benchmarkRun.hz < 100 ? 2 : 0);
    const err = stats.rme.toFixed(2);

    console.log(`${benchmarkRun.name}:    ${ops}  ±${err}% ops/s    ${meanInMillis}  ±${
      stdDevInMillis} ms/op    ( ${runs} run${runs === 0 ? '' : 's'} )`); 

   });

  return suite;
}

function readStateDump (blockNum) {
  const filename = path.join(__dirname + '/../../stateDumps/state_' + blockNum +'.json');
  const pipeline = streamChain.chain([
    fs.createReadStream(filename),
    streamJson.parser(),
    Pick.pick({ filter: 'accounts' }),
    streamObject.streamObject(),
  ]);

  return pipeline;
}

async function _readFixedFromDump (blockNum, numKeys) {
  const pipeline = readStateDump(blockNum);
  const batchOps = []
  let readKeys = 0;
  for await (const data of asyncChunks(pipeline)) {
    const key = ethUtil.keccak256(Buffer.from(data.key, 'hex'));
    const val = ethAccountToRlp(data.value);
    if (readKeys !== numKeys) {
      batchOps.push({
        key: key,
        val: val,
        value: val,
        type: 'put'
      })
      readKeys += 1;
    }
  }
  return batchOps;
}

function readFixedFromDump (blockNum, numKeys) {
  let batchOps = []
  _readFixedFromDump(blockNum, numKeys).then((ops) => batchOps = ops);
  wait.for.predicate(() => (numKeys > 0)? (batchOps.length === numKeys): batchOps.length !== 0);
  return batchOps;
}
