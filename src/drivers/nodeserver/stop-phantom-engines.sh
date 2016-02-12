#!/bin/bash

echo "Stopping the phantom engines on 10 ports ranging from 3101 to 3110\n";
forever stop 0
pkill -f phantom/shim.js
