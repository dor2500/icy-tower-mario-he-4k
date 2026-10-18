import sys,re
def mask(p):
    m=0
    for i,c in enumerate(p): m^=c<<((i&3)*8)
    pos=0
    for i in range(4):
        m^=p[pos]<<(24-i*8); pos+=1
        if pos>=len(p): pos=0
    return m&0xffffffff
exe=open(sys.argv[1],'rb').read()
target=0x736C6821 ^ int.from_bytes(open(sys.argv[2],'rb').read(4),'big')
print(hex(target))
for m_ in re.finditer(rb'[\x20-\x7e]{3,}',exe):
    s=m_.group()
    for a in range(len(s)):
        for b in range(a+1,min(len(s),a+40)+1):
            p=s[a:b]
            mk=mask(p)
            if mk^42==target: print('NEW',hex(m_.start()+a),p)
            if mk==target: print('OLD',hex(m_.start()+a),p)
