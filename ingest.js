var axios = require('axios');
const { response } = require('express');
var data = JSON.stringify({
    numberToProcess: 10000,
});

var config = {
    method: 'post',
    url: 'http://localhost:8080',
    headers: {
        'Content-Type': 'application/json',
    },
    data: data,
};
let result = null;

const run = async () => {
    while (true) {
        result = await axios(config);
        console.log(JSON.stringify(result.data));
    }
};

run();
