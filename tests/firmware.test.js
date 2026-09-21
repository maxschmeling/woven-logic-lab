// Compile the actual downloaded sketch as C++ with a GPIO/diode-ROM harness.
// This checks reader logic and pin states, NOT real electrical characteristics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { compile, firmware } from '../site/logic.js';

test('generated Arduino C++ reads physical bits, including a changed board, and releases every row', () => {
  const dir = mkdtempSync(join(tmpdir(), 'woven-reader-'));
  try {
    const model = compile('INPUT a,b,c\ns = a XOR b XOR c\nx = a AND b\ny = NOT a\nz = 1');
    const harness = `#include <cassert>
#include <string>
#include <iostream>
using byte = unsigned char;
constexpr int INPUT=0, OUTPUT=1, INPUT_PULLUP=2, LOW=0, HIGH=1;
constexpr int A0=14,A1=15,A2=16,A3=17;
int modes[20]={}, levels[20]={}, requested=0;
int board[8][4] = {${model.rows.map(r => '{' + r.values.join(',') + '}').join(',')}};
struct SerialType { std::string text; void begin(int){} void print(const char*s){text+=s;} void print(char c){text+=c;} void print(byte n){text+=std::to_string(n);} void println(){text+='\\n';} } Serial;
void pinMode(int p,int m){modes[p]=m;}
void digitalWrite(int p,int v){levels[p]=v;}
void delay(int){} void delayMicroseconds(int){}
int digitalRead(int p){
 if(p>=10&&p<=12)return ((requested>>(12-p))&1)?LOW:HIGH;
 int active=-1;
 for(int r=0;r<8;r++){if(modes[r+2]==OUTPUT){assert(active==-1); assert(levels[r+2]==LOW); active=r;}}
 assert(active>=0); assert(modes[p]==INPUT_PULLUP);
 return board[active][p-A0]?LOW:HIGH;
}
${firmware(model)}
int main(){setup(); for(int pass=0;pass<2;pass++){for(requested=0;requested<8;requested++){
 Serial.text.clear(); loop();
 std::string expected="row "+std::to_string(requested)+" -> ";
 for(int c=0;c<4;c++){expected+=board[requested][c]?'1':'0';if(c<3)expected+=' ';}expected+='\\n';
 assert(Serial.text==expected);
 for(int r=0;r<8;r++){assert(modes[r+2]==INPUT);assert(levels[r+2]==LOW);}
 } board[3][2]=1-board[3][2];} std::cout<<"all rows and physical bit mutation passed\\n"; }
`;
    writeFileSync(join(dir, 'harness.cpp'), harness);
    execFileSync(process.env.CXX || 'c++', ['-std=c++17', join(dir, 'harness.cpp'), '-o', join(dir, 'reader')]);
    assert.match(execFileSync(join(dir, 'reader'), { encoding:'utf8' }), /all rows/);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});
