"""Build the six bold, original SVG decks shipped with Memory Card Game 2."""
from pathlib import Path
import csv,json,math

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/decks'
INK='#172c49';BLUE='#245bff';TEAL='#00b89c';ORANGE='#ff7637';YELLOW='#ffc933';RED='#f14c50'
COLORS=[BLUE,ORANGE,TEAL,YELLOW,RED,'#14a9de']
def p(d,c='none',s=INK,w=8):
    return f'<path d="{d}" fill="{c}" stroke="{s}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
def e(x,y,rx,ry,c,s=INK,w=8):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}" stroke="{s}" stroke-width="{w}"/>'
def r(x,y,w,h,c,rad=18,s=INK,sw=8):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rad}" fill="{c}" stroke="{s}" stroke-width="{sw}"/>'
def eye(x,y,rx=8,ry=11):return e(x,y,rx,ry,INK,'none',0)+e(x+2,y-3,2,3,'white','none',0)
def face(x=256,y=254,spread=43):
    return eye(x-spread,y)+eye(x+spread,y)+p(f'M{x-19} {y+35} Q{x} {y+53} {x+19} {y+35}','none',INK,7)
def svg(content):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="white"/>{content}</svg>'

ANIMALS=['fox','dog','cat','lion','tiger','bear','panda','koala','rabbit','mouse','elephant','giraffe','zebra','rhino','hippo','frog','penguin','owl','parrot','duck','fish','shark','whale','dolphin','turtle','crocodile','crab','octopus','dinosaur','ladybird']
def animal(name):
    i=ANIMALS.index(name);c=COLORS[i%len(COLORS)]
    if name in ['fox','cat','dog','lion','tiger','bear','panda','koala','rabbit','mouse','zebra','giraffe','hippo','rhino','elephant']:
        fur={'fox':ORANGE,'cat':TEAL,'dog':'#d79353','lion':YELLOW,'tiger':ORANGE,'bear':'#b77843','panda':'white','koala':'#8daac0','rabbit':'#eef4ff','mouse':'#a0b7ca','zebra':'white','giraffe':YELLOW,'hippo':'#85a9c5','rhino':'#9db2c4','elephant':'#7297be'}[name]
        s=''
        if name=='lion':s+=p('M256 93 L290 118 L333 109 L352 150 L395 171 L385 218 L416 252 L387 287 L396 335 L352 353 L330 392 L287 382 L256 411 L223 382 L180 392 L158 353 L116 335 L125 287 L97 252 L125 218 L116 171 L159 150 L180 109 L223 118 Z',ORANGE)
        if name=='elephant':s+=e(137,256,72,100,fur)+e(375,256,72,100,fur)
        elif name=='rabbit':s+=e(195,137,34,87,fur)+e(316,137,34,87,fur)+e(195,134,12,57,'#ffaf9b','none',0)+e(316,134,12,57,'#ffaf9b','none',0)
        elif name in ['cat','fox','tiger','zebra']:
            s+=p('M148 201 L138 103 L221 152 Z',fur)+p('M291 152 L374 103 L364 201 Z',fur)
        elif name=='dog':s+=e(148,234,42,97,'#95613c')+e(365,234,42,97,'#95613c')
        else:
            s+=e(164,158,40 if name!='mouse' else 64,43,INK if name=='panda' else fur)+e(348,158,40 if name!='mouse' else 64,43,INK if name=='panda' else fur)
        if name=='giraffe':s+=p('M214 145 L209 91 M300 145 L306 91','none',INK,14)+e(209,87,16,16,ORANGE)+e(306,87,16,16,ORANGE)
        s+=e(256,258,114,119,fur)
        if name=='fox':s+=p('M148 263 Q169 353 256 365 Q343 353 364 263 L296 300 L256 282 L216 300 Z','white','none',0)
        if name=='panda':s+=e(210,248,30,40,INK)+e(302,248,30,40,INK)+e(211,246,9,12,'white','none',0)+e(301,246,9,12,'white','none',0)
        else:s+=eye(212,247)+eye(300,247)
        if name in ['tiger','zebra']:
            for x in [205,256,307]:s+=p(f'M{x-13} 157 L{x} 208 L{x+13} 157',INK,'none',0)
            s+=p('M146 239 L187 254 L150 269 M366 239 L325 254 L362 269',INK,'none',0)
        if name=='giraffe':s+=r(177,185,26,23,ORANGE,8,'none',0)+r(311,278,29,24,ORANGE,8,'none',0)+r(220,336,29,22,ORANGE,8,'none',0)
        if name=='elephant':s+=p('M236 286 L236 384 Q236 419 276 409 Q299 403 291 381 L274 353 L274 286',fur)
        elif name in ['hippo','rhino']:
            s+=e(256,319,86,57,fur)+e(222,317,10,8,INK,'none',0)+e(290,317,10,8,INK,'none',0)
            if name=='rhino':s+=p('M240 299 L265 226 L284 304','#fff1bb')
        else:
            s+=e(256,294,16,12,INK,'none',0)+p('M256 307 L256 320 Q231 340 214 320 M256 320 Q281 340 298 320','none',INK,6)
        if name=='dog':s+=p('M249 333 Q261 366 278 339 L280 326',RED,INK,5)
        if name=='cat':s+=p('M169 285 L213 294 M166 310 L211 308 M343 285 L299 294 M346 310 L301 308','none',INK,5)
        return s
    if name=='frog':return e(256,280,133,107,TEAL)+e(180,182,47,49,TEAL)+e(332,182,47,49,TEAL)+e(180,182,29,31,'white')+e(332,182,29,31,'white')+eye(180,182)+eye(332,182)+p('M184 293 Q256 357 328 293','none',INK,9)+e(166,277,18,11,YELLOW,'none',0)+e(346,277,18,11,YELLOW,'none',0)
    if name in ['penguin','owl','parrot','duck']:
        c={'penguin':INK,'owl':ORANGE,'parrot':TEAL,'duck':YELLOW}[name]
        s=e(216,397,42,15,ORANGE)+e(300,397,42,15,ORANGE)+e(256,270,109,135,c)
        if name=='owl':s+=p('M161 199 L156 120 L224 161 M288 161 L356 120 L351 199',c)+e(207,241,45,48,'white')+e(305,241,45,48,'white')
        elif name=='penguin':s+=e(256,293,75,95,'white','none',0)+p('M150 254 L114 331 L149 317 M363 254 L399 331 L364 317',c)
        elif name=='parrot':s+=p('M228 138 Q209 85 265 105 L287 148',YELLOW)+p('M306 288 Q366 284 350 358 L288 386',BLUE)
        s+=eye(215,237)+eye(297,237)
        s+=p('M236 272 L276 272 L256 300 Z',ORANGE) if name!='duck' else e(256,283,58,25,ORANGE)
        return s
    if name in ['fish','shark','whale','dolphin']:
        c={'fish':ORANGE,'shark':'#75a5cf','whale':BLUE,'dolphin':TEAL}[name]
        s=p('M151 249 L80 183 L80 328 L151 286 Z',c)+e(270,265,139,94,c)
        if name=='shark':s+=p('M221 184 L277 103 L304 183',c)+p('M290 298 L378 280 L352 324 L329 306 L314 328 Z','white')
        elif name=='dolphin':s+=p('M356 226 Q446 224 430 256 L370 277',c)+p('M222 178 Q247 129 298 175',c)
        elif name=='whale':s+=p('M256 165 L256 103 M256 123 Q223 87 202 113 M256 123 Q289 87 310 113','none',TEAL,12)+p('M257 341 Q290 395 314 338',c)
        else:s+=p('M247 177 L223 127 L307 182',YELLOW)+p('M243 348 L270 393 L301 345',YELLOW)+p('M185 202 Q168 265 185 325','none',YELLOW,19)
        return s+eye(343,241)+p('M343 290 Q368 309 387 282','none',INK,6)
    if name=='turtle':return e(256,275,116,93,TEAL)+e(256,147,41,48,'#6ed55c')+e(141,228,37,23,'#6ed55c')+e(371,228,37,23,'#6ed55c')+e(166,351,33,25,'#6ed55c')+e(346,351,33,25,'#6ed55c')+p('M227 220 L285 220 L314 273 L285 324 L227 324 L198 273 Z',YELLOW)+eye(242,143,5,7)+eye(270,143,5,7)
    if name=='crocodile':return p('M109 316 L93 239 L144 263 L157 210 L192 237 L215 191 L254 221 L286 174 L326 218 L377 206 Q439 233 425 276 L361 281 L420 301 Q425 344 353 359 L175 356 Z',TEAL)+p('M358 280 L374 302 L390 281','white')+eye(367,239)+p('M171 355 L149 393 L207 385 M301 357 L283 393 L344 386',TEAL)
    if name=='crab':
        s=e(256,284,91,66,RED)+p('M202 237 L197 185 M310 237 L315 185','none',INK,12)+eye(197,177,13,16)+eye(315,177,13,16)
        for x,flip in [(0,''),(512,'translate(512 0) scale(-1 1)')]:
            s+=f'<g transform="{flip}">'+p('M176 275 L119 248 L105 208','none',RED,24)+p('M112 222 Q61 199 83 152 L107 183 L128 142 Q163 191 112 222',RED)+p('M179 300 L122 318 L106 351 M192 330 L159 365 L159 390','none',INK,12)+'</g>'
        return s+p('M234 294 Q256 314 278 294','none',INK,6)
    if name=='octopus':
        s=''
        for i in range(8):
            x=96+i*46;s+=p(f'M{205+i*14} 303 Q{x} 404 {x} 354','none',ORANGE,25)
        return s+e(256,236,100,112,ORANGE)+face(256,236,37)
    if name=='dinosaur':return p('M141 360 L97 287 L160 306 L175 217 Q174 150 246 142 Q335 136 354 190 L406 211 L393 263 L315 269 L302 355 L327 384 L272 388 L255 353 L212 355 L204 387 L149 387 Z',TEAL)+p('M183 204 L165 175 L203 177 M224 147 L223 112 L255 142 M271 145 L290 114 L307 155',ORANGE)+eye(318,201)+p('M352 244 L384 244','none',INK,6)
    if name=='ladybird':return e(256,282,112,125,RED)+e(256,155,61,47,INK)+p('M256 179 L256 402','none',INK,9)+e(205,241,22,24,INK,'none',0)+e(308,241,22,24,INK,'none',0)+e(196,322,23,24,INK,'none',0)+e(317,322,23,24,INK,'none',0)+p('M220 120 L201 92 M292 120 L311 92','none',INK,9)
    raise ValueError(name)

VEHICLES=['racing-car','taxi','police-car','pickup','camper','van','bus','school-bus','fire-engine','lorry','dump-truck','tractor','excavator','bulldozer','plane','jet','biplane','helicopter','rocket','sailboat','speedboat','ship','submarine','train','tram','bicycle','scooter','motorbike','balloon','spaceship']
def vehicle(name,variant=0):
    i=VEHICLES.index(name);c=COLORS[(i+variant)%len(COLORS)]
    if name in VEHICLES[:14]:
        s=e(154,365,44,44,INK)+e(362,365,44,44,INK)+e(154,365,20,20,'white','none',0)+e(362,365,20,20,'white','none',0)
        if name in ['bus','school-bus','camper','van','lorry','fire-engine']:
            s+=r(86,180,341,162,c,22)
            for x in ([112,179,246,313] if name!='lorry' else [325]):s+=r(x,205,48,62,'#d6efff',8)
            if name=='camper':s+=r(198,261,53,80,'white',8)
            if name=='lorry':s+=r(83,151,229,172,TEAL,9)+p('M110 185 L282 185 M110 220 L282 220','none','white',8)
            if name=='fire-engine':s+=p('M111 154 L364 154 M126 139 L126 169 M171 139 L171 169 M216 139 L216 169 M261 139 L261 169 M306 139 L306 169 M351 139 L351 169','none',INK,8)+r(300,160,32,18,BLUE,4)
        elif name in ['tractor','excavator','bulldozer']:
            s+=r(125,241,265,97,c,13)+r(176,166,114,126,c,13)+r(195,187,72,61,'#d6efff',7)
            if name=='excavator':s+=p('M288 205 L360 141 L419 227 L445 258','none',ORANGE,24)+p('M417 246 L458 251 L441 304 L405 293 Z',YELLOW)
            elif name=='bulldozer':s+=p('M390 285 L432 262 L438 367 L395 361 Z',YELLOW)+r(119,332,281,55,INK,22)+p('M148 361 L369 361','none','#8094aa',12)
            else:s+=e(161,354,58,58,INK)+e(161,354,27,27,YELLOW)+p('M330 241 L330 186','none',INK,14)
        else:
            s+=p('M83 318 L103 269 L177 256 L216 193 L319 193 L366 253 L415 270 L433 327 L426 345 L88 345 Z',c)
            s+=p('M202 248 L229 211 L307 211 L337 248 Z','#d6efff')+p('M268 215 L268 247','none',INK,7)
            if name=='pickup':s+=r(89,245,119,55,TEAL,3)
            if name=='police-car':s+=r(228,171,83,18,RED,7)+r(269,171,42,18,BLUE,7)+e(269,297,22,22,YELLOW)
            if name=='taxi':s+=r(246,170,48,20,YELLOW,4)+p('M201 295 L322 295','none',INK,9)
            if name=='racing-car':s+=p('M116 263 L99 220 L143 220 L162 257','none',INK,10)+p('M187 294 L344 294','none','white',17)
        return s+r(402,293,23,19,YELLOW,5)
    if name in ['plane','jet','biplane','helicopter','spaceship']:
        if name=='helicopter':return p('M151 238 L77 210 L82 284 L163 293 Z',c)+e(292,270,119,77,c)+p('M283 196 L283 147 M155 147 L414 147','none',INK,13)+p('M204 349 L204 382 M341 344 L341 382 M163 382 L385 382','none',INK,11)+r(291,224,89,62,'#d6efff',18)+p('M99 218 L99 279','none',ORANGE,13)
        if name=='spaceship':return p('M255 101 L311 226 L418 357 L296 326 L255 400 L214 326 L92 357 L199 226 Z',c)+p('M255 153 L278 243 L233 243 Z','#d6efff')+p('M230 348 L255 414 L279 348',ORANGE)
        s=p('M239 109 Q256 83 273 109 L291 228 L435 306 L425 335 L284 293 L277 375 L319 402 L315 423 L256 405 L197 423 L193 402 L235 375 L228 293 L87 335 L77 306 L221 228 Z',c)
        s+=e(256,170,15,31,'#d6efff')
        if name=='biplane':s+=p('M106 261 L406 261 M122 230 L122 296 M390 230 L390 296','none',ORANGE,21)+p('M223 104 L289 104','none',INK,13)
        if name=='jet':s+=p('M111 312 L173 238 L223 236 M401 312 L339 238 L289 236',YELLOW)
        return s
    if name=='rocket':return p('M202 304 L137 364 L143 275 L202 230 M310 304 L375 364 L369 275 L310 230',BLUE)+p('M222 352 Q226 415 256 441 Q286 415 290 352',ORANGE)+p('M237 356 Q238 398 256 416 Q274 398 275 356',YELLOW,'none',0)+p('M199 353 L199 223 Q201 141 256 86 Q311 141 313 223 L313 353 Z',RED)+p('M202 210 L310 210 L299 163 L213 163 Z','white','none',0)+e(256,257,37,37,'#70d5ff')+p('M212 333 L299 333','none',INK,8)
    if name in ['sailboat','speedboat','ship','submarine']:
        if name=='submarine':return r(83,235,346,122,YELLOW,60)+r(224,186,90,49,YELLOW,12)+p('M265 187 L265 138 L304 138','none',INK,16)+e(177,296,28,28,'#70d5ff')+e(270,296,28,28,'#70d5ff')+p('M408 252 L441 223 L441 368 L410 337',ORANGE)
        s=p('M89 308 L428 308 L391 382 L144 382 Z',c)
        if name=='sailboat':s+=p('M256 308 L256 112','none',INK,10)+p('M242 127 L242 290 L120 290 Z',YELLOW)+p('M272 147 L272 290 L391 290 Z',BLUE)
        elif name=='speedboat':s+=p('M167 307 L208 228 L312 228 L356 307 Z','#d6efff')
        else:
            s+=r(153,212,205,97,'white',10)+r(208,165,51,46,ORANGE,5)+p('M181 239 L194 239 M229 239 L242 239 M277 239 L290 239 M325 239 L338 239','none',BLUE,14)
        return s+p('M89 405 Q120 428 151 405 Q182 428 213 405 Q244 428 275 405 Q306 428 337 405 Q368 428 399 405','none',TEAL,10)
    if name in ['train','tram']:
        s=r(105,169,307,195,c,28)+r(132,201,86,81,'#d6efff',12)+r(240,201,86,81,'#d6efff',12)+e(169,367,32,32,INK)+e(346,367,32,32,INK)
        if name=='train':s+=r(138,123,48,45,YELLOW,6)+p('M334 338 L429 338 L447 367 L333 367 Z',ORANGE)
        else:s+=p('M210 167 L235 107 L294 107 L319 167','none',INK,10)
        return s+p('M88 407 L426 407','none',INK,10)
    if name in ['bicycle','scooter','motorbike']:
        s=e(140,342,63,63,'white')+e(373,342,63,63,'white')
        if name=='bicycle':s+=p('M140 342 L202 228 L272 342 L140 342 L238 268 L373 342 L333 200 M310 200 L355 200 M184 221 L231 221','none',c,17)
        elif name=='scooter':s+=p('M140 342 L306 342 L356 178 L385 178','none',c,23)+p('M324 178 L387 178','none',INK,14)
        else:s+=p('M134 330 L205 250 L309 260 L372 331 L279 331 L228 288 L188 333 Z',c)+p('M332 258 L350 197 L382 197 M203 244 L260 244','none',INK,16)
        return s
    if name=='balloon':return e(256,207,119,128,c)+p('M229 89 Q183 207 230 332 M283 89 Q329 207 282 332','none',YELLOW,22)+p('M192 316 L219 377 M320 316 L293 377','none',INK,9)+r(208,372,96,66,ORANGE,13)
    raise ValueError(name)

def robot(i,level):
    hard=level=='Hard';medium=level=='Medium';c=BLUE if hard else ('#16c5d9' if medium else COLORS[i%6])
    arm=(i//5)%6;leg=i%5
    hands=[[(111,280),(401,280)],[(135,140),(377,140)],[(177,350),(335,350)],[(122,182),(390,350)],[(143,359),(371,155)],[(195,130),(317,130)]][arm]
    feet=[[(211,418),(301,418)],[(175,418),(337,418)],[(219,422),(355,351)],[(154,358),(294,422)],[(181,399),(336,388)]][leg]
    s=''
    for j,(x,y) in enumerate(feet):s+=p(f'M{229+j*54} 330 L{x} {y-13}','none',INK,24)+r(x-26,y-12,52,27,ORANGE,7)
    for j,(x,y) in enumerate(hands):s+=p(f'M{196+j*120} 255 Q{180+j*152} 269 {x} {y}','none',INK,23)+e(x,y,24,24,YELLOW)
    s+=r(188,235,136,111,c,18)+r(214,262,84,53,'white',9)
    s+=e(239,285,9,9,RED,'none',0)+e(272,285,9,9,TEAL,'none',0)+p('M225 326 L286 326','none',INK,7)
    antenna=0 if hard else i%4
    if antenna==0:s+=p('M256 130 L256 91','none',INK,10)+e(256,80,17,17,RED)
    elif antenna==1:s+=p('M213 137 L198 89 M298 137 L313 89','none',INK,9)+e(197,81,13,13,YELLOW)+e(314,81,13,13,YELLOW)
    elif antenna==2:s+=p('M226 135 L220 94 L284 94 L278 135',YELLOW)
    else:s+=p('M254 133 L241 112 L267 94 L250 74','none',INK,10)
    s+=r(160,169,26,49,ORANGE,9)+r(326,169,26,49,ORANGE,9)
    head_radius=22 if hard else [12,42,25][i%3]
    s+=r(180,130,152,111,c,head_radius)+r(195,148,122,77,'white',14)
    expression=i%5
    if expression==0:s+=eye(226,178,11,13)+eye(286,178,11,13)
    elif expression==1:s+=p('M214 181 Q226 162 238 181 M274 181 Q286 162 298 181','none',INK,8)
    elif expression==2:s+=r(212,166,27,23,INK,3,'none',0)+r(274,166,27,23,INK,3,'none',0)
    elif expression==3:s+=eye(226,179,12,16)+p('M275 181 L298 181','none',INK,8)
    else:s+=p('M213 169 L238 180 L213 191 M299 169 L274 180 L299 191','none',INK,8)
    s+=p('M235 205 L277 205','none',INK,6) if expression in [0,3] else p('M235 199 Q256 221 277 199','none',INK,6)
    return s

def item(name):
    if name in ANIMALS:return animal(name)
    if name in VEHICLES:return vehicle(name,2)
    if name=='robot':return robot(31,'Easy')
    if name=='planet':return e(256,256,108,108,BLUE)+p('M152 220 C30 261 78 343 275 300 C455 260 461 167 349 194','none',YELLOW,28)+e(219,204,25,18,'#72cfff','none',0)+e(291,257,18,15,'#72cfff','none',0)
    if name=='ufo':return e(256,239,92,88,'#70d5ff')+e(256,294,168,52,TEAL)+e(153,293,17,12,YELLOW)+e(256,312,17,12,ORANGE)+e(359,293,17,12,YELLOW)+p('M214 363 L184 412 M298 363 L328 412','none',YELLOW,12)
    if name=='pizza':return p('M126 126 Q255 76 386 126 L256 420 Z',YELLOW)+p('M126 128 Q256 80 386 128','none',ORANGE,34)+e(207,188,21,21,RED)+e(300,186,21,21,RED)+e(257,286,21,21,RED)+p('M195 254 L210 239 M303 247 L317 261','none',TEAL,9)
    if name=='football':return e(256,256,138,138,'white')+p('M230 208 L284 208 L304 258 L256 291 L208 258 Z',INK)+p('M231 121 L230 166 L177 183 L147 161 M362 160 L335 183 L284 165 L283 121 M389 281 L346 272 L319 318 L346 361 M167 361 L192 317 L166 272 L123 283 M230 392 L229 346 L283 346 L283 392','none',INK,15)
    if name=='icecream':return p('M185 274 L327 274 L256 433 Z',YELLOW)+p('M205 312 L284 356 M217 352 L302 305','none',ORANGE,7)+e(256,232,93,65,BLUE)+e(223,186,58,54,ORANGE)+e(285,176,56,57,RED)
    if name=='apple':return p('M256 184 Q179 119 133 210 Q93 297 174 385 Q216 421 256 393 Q296 421 338 385 Q419 297 379 210 Q333 119 256 184 Z',RED)+p('M255 180 Q253 132 279 103','none',INK,14)+p('M279 125 Q329 75 371 119 Q328 162 279 145 Z',TEAL)+p('M174 227 Q154 267 169 298','none','white',15)
    if name=='pineapple':
        s=p('M196 174 L171 105 L229 140 L256 76 L282 140 L343 105 L316 174',TEAL)+r(155,166,202,239,YELLOW,80)
        s+='<defs><clipPath id="fruit"><rect x="155" y="166" width="202" height="239" rx="80"/></clipPath></defs><g clip-path="url(#fruit)">'
        for x in range(64,349,48):s+=p(f'M{x} 187 L{x+100} 367 M{x+110} 187 L{x+10} 367','none',ORANGE,6)
        return s+'</g>'+r(155,166,202,239,'none',80)
    if name=='burger':return p('M118 223 Q125 112 256 112 Q387 112 394 223 Z',ORANGE)+p('M142 169 L159 162 M219 142 L232 148 M309 151 L323 144 M347 186 L363 179','none',YELLOW,8)+r(110,231,292,43,TEAL,18)+p('M119 277 L388 277 L340 317 L280 291 L221 319 L175 293 L124 309 Z',YELLOW)+r(111,316,291,42,'#98502c',19)+r(122,365,269,40,ORANGE,14)
    if name=='guitar':return p('M287 125 L328 143 L273 284 Q339 315 305 376 Q272 436 201 400 Q132 366 170 310 Q185 281 219 289 Z',ORANGE)+p('M284 119 L299 80 L347 99 L332 143 Z',YELLOW)+e(236,340,28,28,INK)+p('M307 131 L235 341','none','white',7)+r(185,369,66,14,INK,4)
    if name=='camera':return r(105,196,302,196,BLUE,30)+p('M173 194 L196 148 L280 148 L304 194',YELLOW)+e(256,292,77,77,INK)+e(256,292,52,52,'#70d5ff')+e(237,274,17,17,'white','none',0)+r(344,217,39,23,ORANGE,7)
    if name=='kite':return p('M256 91 L365 214 L256 339 L147 214 Z',YELLOW)+p('M256 91 L256 339 M148 214 L364 214','none',INK,8)+p('M256 339 Q173 392 250 429','none',BLUE,8)+p('M232 361 L193 350 L203 384 Z',ORANGE)+p('M218 398 L250 385 L257 420 Z',TEAL)
    if name=='controller':return p('M166 185 L345 185 Q398 190 420 337 Q427 402 374 380 L307 328 L205 328 L138 380 Q85 402 92 337 Q114 190 166 185 Z',BLUE)+p('M168 228 L168 296 M134 262 L202 262','none','white',19)+e(342,239,15,15,YELLOW)+e(376,269,15,15,RED)+e(316,273,15,15,TEAL)+e(348,306,15,15,ORANGE)
    raise ValueError(name)

MIX=['rocket','robot','tiger','racing-car','penguin','pizza','planet','elephant','sailboat','football','crab','icecream','helicopter','dinosaur','ufo','turtle','guitar','submarine','fox','apple','train','octopus','bicycle','pineapple','camera','owl','kite','burger','dog','controller']
def main():
    OUT.mkdir(parents=True,exist_ok=True);index=[];plan=[]
    decks=[('mix_easy','Mix & Match','Mix & Match','Easy'),('animals_easy','Wild Things','Animals','Easy'),('vehicles_easy','On the Move','Vehicles','Easy'),('robots_easy','Bots & Bolts','Robots','Easy'),('robots_medium','Bot Buddies','Robots','Medium'),('robots_hard','Robot Replay','Robots','Hard')]
    for ident,title,domain,level in decks:
        folder=OUT/ident;folder.mkdir(exist_ok=True);entries=[]
        for i in range(30):
            if domain=='Mix & Match':
                subject=MIX[i];inner=f'<g transform="rotate({-4 if i%2==0 else 4} 256 256)">{item(subject)}</g>'
            elif domain=='Animals':subject=ANIMALS[i];inner=animal(subject)
            elif domain=='Vehicles':subject=VEHICLES[i];inner=vehicle(subject)
            else:subject=f'robot; arms {i//5+1}; legs/expression {i%5+1}';inner=robot(i,level)
            filename=f'{i+1:02d}.svg';(folder/filename).write_text(svg(inner),encoding='utf8')
            entries.append({'pair_id':f'{ident}_{i+1:02d}','path':filename})
            plan.append([ident,i+1,subject])
        manifest={'version':1,'id':ident,'title':title,'domain':domain,'style':'Illustrated','complexity':level,'images':entries}
        (folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
        index.append(f'res://assets/decks/{ident}/manifest.json')
    (OUT/'library.json').write_text(json.dumps(index,indent=2),encoding='utf8')
    with (ROOT/'docs/artwork-plan.csv').open('w',newline='',encoding='utf8') as f:
        w=csv.writer(f);w.writerow(['deck','image','distinguishing_features']);w.writerows(plan)
    (ROOT/'assets/icon.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect x="3" y="3" width="250" height="250" rx="52" fill="#172c49"/><rect x="43" y="45" width="112" height="150" rx="20" fill="#ffc933" transform="rotate(-12 99 120)"/><rect x="99" y="54" width="116" height="150" rx="20" fill="#245bff" stroke="white" stroke-width="8" transform="rotate(9 157 129)"/><circle cx="157" cy="129" r="31" fill="white"/><path d="M139 129 L153 142 L178 115" fill="none" stroke="#00b89c" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>''',encoding='utf8')
    (ROOT/'assets/card_back.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect x="3" y="3" width="250" height="250" rx="24" fill="#245bff" stroke="#172c49" stroke-width="6"/><rect x="15" y="15" width="226" height="226" rx="15" fill="none" stroke="#74b9ff" stroke-width="3"/><g fill="#74b9ff"><circle cx="41" cy="41" r="6"/><circle cx="215" cy="215" r="6"/><path d="M201 34 L221 34 L221 54 L201 54 Z M35 201 L55 201 L55 221 L35 221 Z"/></g><rect x="61" y="68" width="88" height="115" rx="16" fill="#ffc933" transform="rotate(-12 105 126)"/><rect x="111" y="73" width="88" height="115" rx="16" fill="white" transform="rotate(10 155 131)"/><circle cx="155" cy="131" r="23" fill="#00b89c"/><path d="M144 131 L153 140 L168 122" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>''',encoding='utf8')
    print('Generated 180 bold neutral illustrations, six decks, card back and app icon.')
if __name__=='__main__':main()
