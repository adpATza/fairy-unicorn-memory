"""Rebuild all 180 original vector illustrations. No network or third-party assets."""
from pathlib import Path
import colorsys, json, math, csv

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artwork/classic-starter-decks'
INK = '#59425f'
def hsv(h, s=.36, v=.90):
    return '#%02x%02x%02x' % tuple(round(x*255) for x in colorsys.hsv_to_rgb(h%1, s, v))
def svg(inner):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#fff9f0"/>{inner}</svg>'
def path(d, fill='none', stroke=INK, sw=5, extra=''):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'
def ell(x,y,rx,ry,c,extra=''):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}" {extra}/>'
def flower(x,y,c,size=10):
    return ''.join(ell(x+math.cos(k*math.pi/2)*size*.65,y+math.sin(k*math.pi/2)*size*.65,size*.62,size*.62,c) for k in range(4))+ell(x,y,size*.35,size*.35,'#f2cf7e')
def fairy(i, level):
    hard=level=='Hard'; med=level=='Medium'
    hue=.76 if hard else (.69 + .018*(i%5) if med else i*.618+.127)
    dress=hsv(hue,.50 if not hard and not med else .40,.86); light=hsv(hue,.20,.98); deep=hsv(hue,.55,.65)
    skin=['#eac1a1','#c68c70','#f0cfb2','#9f6a59','#dca887'][0 if hard else i%5]
    hair=['#81513f','#463b54','#d5a55c','#a66147','#554442'][1 if hard else (i//2)%5]
    # Six deliberately large arm silhouettes, five leg silhouettes = 30 hard subjects.
    arms=[[(168,256),(344,256)],[(162,184),(350,184)],[(204,298),(308,298)],[(157,220),(338,158)],[(182,158),(350,274)],[(210,154),(302,154)]]
    legs=[[(219,421),(295,421)],[(191,401),(320,418)],[(235,424),(327,365)],[(185,363),(278,424)],[(208,408),(319,388)]]
    arm=arms[i//5 if hard else i%6]; leg=legs[i%5]
    wingtype=1 if hard else (i//5)%3
    w=f'<g stroke="{deep}" stroke-width="4" stroke-linejoin="round">'
    if wingtype==0:
        w+=path('M242 254 C122 250 70 110 116 97 C173 80 230 149 247 236 Z',light,deep,4)
        w+=path('M270 254 C390 250 442 110 396 97 C339 80 282 149 265 236 Z',light,deep,4)
        w+=path('M238 246 C134 225 101 333 153 329 C199 325 226 292 246 261 Z',light,deep,4)
        w+=path('M274 246 C378 225 411 333 359 329 C313 325 286 292 266 261 Z',light,deep,4)
    elif wingtype==1:
        for flip in [False,True]:
            w+=f'<g transform="{"translate(512 0) scale(-1 1)" if flip else ""}">'
            w+=path('M244 262 C157 237 81 159 107 114 C132 75 227 126 244 222 Z',light,deep,4)
            w+=path('M243 255 C173 249 108 281 124 324 C143 370 223 299 246 273 Z',light,deep,4)
            w+=path('M239 240 Q191 185 125 129 M237 264 Q181 289 139 319','none',deep,2)
            w+=ell(153,161,10,16,'#fff5da')+ell(157,301,7,10,'#fff5da')+'</g>'
    else:
        for flip in [False,True]:
            w+=f'<g transform="{"translate(512 0) scale(-1 1)" if flip else ""}">'
            w+=path('M246 260 Q99 248 102 111 Q218 112 246 234 Z',light,deep,4)
            w+=path('M237 256 Q94 269 145 355 Q233 318 247 272 Z',light,deep,4)
            w+=path('M235 237 Q165 194 119 128 M235 274 L156 337','none',deep,2)+'</g>'
    w+='</g>'
    s=ell(256,441,91,9,'#eadfe5')+w
    for n,foot in enumerate(leg):
        hip=(236+n*39,337)
        s+=path(f'M{hip[0]} {hip[1]} Q{(hip[0]+foot[0])/2} {foot[1]-30} {foot[0]} {foot[1]}','none',skin,18)
        s+=ell(foot[0]+(-5 if n==0 else 5),foot[1]+1,18,9,deep)
    for n,hand in enumerate(arm):
        shoulder=(230+n*52,225)
        s+=path(f'M{shoulder[0]} 229 Q{(shoulder[0]+hand[0])/2} {hand[1]+10} {hand[0]} {hand[1]}','none',skin,17)
        s+=ell(*hand,10,10,skin)
    # Petal skirts have different silhouettes in easy/medium, constant in hard.
    hem=0 if hard else (i//3)%3
    if hem==0:d='M232 216 Q256 206 280 216 L300 278 Q322 307 323 334 Q291 352 256 339 Q221 352 189 334 Q192 300 212 278 Z'
    elif hem==1:d='M232 216 Q256 206 280 216 L298 274 L333 330 L291 319 L257 350 L223 319 L180 330 L214 274 Z'
    else:d='M232 216 Q256 206 280 216 Q288 276 310 302 L309 337 Q258 371 202 337 L200 302 Q224 274 232 216 Z'
    s+=path(d,dress,deep,4)
    s+=path('M214 280 Q255 300 298 279','none',light,5)
    s+=path('M236 250 Q255 262 276 250','none',deep,3)
    s+=flower(256,269,'#fff1c9',9)
    s+=ell(256,176,49,55,hair)
    hairstyle=0 if hard else i%5
    if hairstyle in [1,3]:
        s+=ell(203,183,24,45,hair)+ell(309,183,24,45,hair)
    if hairstyle==2:s+=ell(256,114,30,26,hair)
    s+=ell(256,180,39,44,skin)
    s+=path('M214 163 Q214 116 256 128 Q300 117 299 164 Q267 162 252 142 Q239 162 214 163 Z',hair,hair,2)
    if hairstyle==4:s+=path('M217 149 Q202 223 218 243','none',hair,16)
    s+=ell(234,190,8,4,'#cf8e92')+ell(278,190,8,4,'#cf8e92')
    expression=i%5 if hard else i%3
    if expression==1:
        s+=path('M231 176 Q238 170 245 176 M266 176 Q273 170 280 176','none',INK,3)
    elif expression==2:
        s+=path('M231 176 L245 181 M266 181 L280 176','none',INK,3)
    else:
        s+=ell(239,177,3.5,5,INK)+ell(273,177,3.5,5,INK)
        s+=ell(240,175,1,1,'#ffffff')+ell(274,175,1,1,'#ffffff')
    if expression==3:s+=ell(256,197,5,7,INK)
    else:s+=path('M247 197 Q256 205 265 197','none',INK,3)
    s+=flower(223,143,'#f2cc8b',10)+flower(244,132,light,8)
    return svg(s), f'arms pose {i//5+1 if hard else i%6+1}; legs pose {i%5+1}; expression {expression+1}; wing silhouette {wingtype+1}; garment {hem+1}'

def unicorn(i,level):
    hard=level=='Hard';med=level=='Medium'
    hue=.76 if hard else (.70+.018*(i%5) if med else i*.618)
    mane=hsv(hue,.43,.80); shine=hsv(hue,.24,.96); deep=hsv(hue,.50,.61)
    coat='#f1e9f5' if hard else (['#f5e9ed','#e6ebf7','#f6e4ce','#e5f0e6','#e9e0f1'][i%5] if not med else '#eee6f3')
    pose=i//5 if hard else i%6
    angle=[-18,-8,2,14,27][i%5] if hard else [-15,0,15][i%3]
    # A recognizable quadruped with six very different leg arrangements.
    feet=[[(151,400),(205,400),(303,400),(351,400)],[(119,363),(220,399),(327,347),(364,399)],[(130,400),(191,355),(327,400),(370,354)],[(153,388),(211,388),(286,359),(350,365)],[(122,364),(190,399),(320,390),(370,335)],[(143,399),(216,363),(288,399),(367,375)]][pose]
    s=ell(257,424,135,10,'#eadfe5')
    s+=path('M155 252 C94 190 75 298 116 343 Q113 288 155 288 Z',mane,deep,4)
    s+=path('M144 252 Q98 255 112 320','none',shine,6)
    for n,(x,y) in enumerate(feet):
        hip=[(170,291),(198,298),(291,299),(318,287)][n]
        knee=((hip[0]+x)/2, (hip[1]+y)/2 +(-18 if pose in [1,2,4] else 0))
        s+=path(f'M{hip[0]} {hip[1]} Q{knee[0]} {knee[1]} {x} {y}', 'none', INK,23)
        s+=path(f'M{hip[0]} {hip[1]} Q{knee[0]} {knee[1]} {x} {y}', 'none', coat,17)
        s+=path(f'M{x-7} {y} L{x+8} {y}', 'none',deep,12)
    s+=path('M145 259 C140 202 225 203 276 223 Q301 216 315 201 L348 245 C326 284 309 321 237 324 C180 325 144 305 145 259 Z',coat,INK,4)
    s+=path('M171 285 Q211 313 272 296','none','#d2bfdd',3)
    # Head tilt and facial changes are intentionally large at thumbnail scale.
    s+=f'<g transform="rotate({angle} 317 224)">'
    s+=path('M284 268 C286 226 285 163 311 131 C336 106 369 130 367 162 Q386 175 407 184 Q423 204 400 216 L358 212 L344 269 Z',coat,INK,4)
    s+=path('M312 141 L303 102 Q320 103 331 128',coat,INK,4)
    s+=path('M341 128 L349 101 L363 134',coat,INK,4)
    s+=path('M359 143 L381 72 L384 157 Z','#f0d38d',INK,4)
    s+=path('M370 125 L382 133 M375 107 L383 114','none','#c6a05d',3)
    manetype=0 if hard else (i//5)%3
    if manetype==0:
        s+=path('M330 126 C284 111 271 165 277 194 Q252 215 273 244 Q256 261 277 286 L305 270 Q288 244 308 218 Q293 195 311 170 Q305 147 330 126 Z',mane,deep,4)
    elif manetype==1:
        s+=path('M333 124 Q288 105 283 151 L267 178 L279 189 L261 220 L280 227 L266 265 L298 279 L294 236 L310 213 L299 183 L319 157 Z',mane,deep,4)
    else:
        s+=path('M332 127 Q285 103 278 144 Q256 155 276 180 Q254 200 275 221 Q250 253 280 279 L304 266 Q287 248 304 227 Q286 204 308 180 Q292 157 332 127 Z',mane,deep,4)
    s+=path('M310 139 Q280 159 294 186 Q276 210 291 239 Q279 255 287 263','none',shine,5)
    expression=i%5
    if expression==1:s+=path('M346 170 Q355 160 365 170','none',INK,4)
    elif expression==2:s+=path('M346 164 L362 175','none',INK,4)
    else:s+=ell(354,168,5,7,INK)+ell(355,166,1.7,2,'#ffffff')
    s+=ell(393,195,3,4,INK)+ell(366,192,11,6,'#d9acc5')
    s+=path('M387 208 Q398 207 402 202','none',INK,3)
    if not hard:
        marking=i%3
        if marking==0:s+=path('M337 183 Q342 208 352 210 L346 192 Z',shine,'none',0)
        elif marking==1:s+=ell(339,191,8,10,shine)
    s+='</g>'
    if not hard:
        # Markings belong to the animal; backgrounds are identical in every card.
        mark=(i//3)%3
        if mark==0:
            s+=ell(196,254,16,20,shine)+ell(216,271,10,13,mane)
        elif mark==1:s+=path('M180 242 Q206 225 222 249 Q207 278 181 270 Z',shine,deep,2)
        else:s+=flower(198,258,mane,15)
    return svg(s), f'leg arrangement {pose+1}; head angle {angle} degrees; expression {expression+1}; mane silhouette {manetype+1}'

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    index=[];plan=[]
    for domain,fn in [('Fairies',fairy),('Unicorns',unicorn)]:
        for level in ['Easy','Medium','Hard']:
            ident=f'{domain.lower()}_{level.lower()}'
            folder=OUT/ident;folder.mkdir(exist_ok=True)
            entries=[]
            for i in range(30):
                content,features=fn(i,level)
                name=f'{i+1:02d}.svg';(folder/name).write_text(content,encoding='utf8')
                entries.append({'pair_id':f'{ident}_{i+1:02d}','path':name})
                plan.append([ident,i+1,features])
            manifest={'version':1,'id':ident,'title':f'{["Meadow", "Moonlit", "Whispering"][ ["Easy","Medium","Hard"].index(level)]} {domain.lower()}','domain':domain,'style':'Illustrated','complexity':level,'images':entries}
            (folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
            index.append(f'res://artwork/classic-starter-decks/{ident}/manifest.json')
    (OUT/'library.json').write_text(json.dumps(index,indent=2),encoding='utf8')
    with (ROOT/'artwork/classic-starter-decks/artwork-plan.csv').open('w',newline='',encoding='utf8') as f:
        w=csv.writer(f);w.writerow(['deck','image','distinguishing_features']);w.writerows(plan)
    print('Created 180 original illustrations in six decks.')
if __name__=='__main__':main()
