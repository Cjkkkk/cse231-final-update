
import { assert } from "chai";
import { BinOp, Expr, Stmt, Type, UniOp, TypeDef, FuncStmt, VarStmt, isClass } from "./ast";
type VarSymbol = {tag: "var", type: Type}
type FuncSymbol = {tag: "func", type: [Type[], Type]}
type ClassSymbol = {tag: "class", type: {methods: Map<string, [Type[], Type]>, fields: Map<string, Type>}}
type UnionSymbol = VarSymbol | FuncSymbol | ClassSymbol
type SymbolTable = Map<string, UnionSymbol>
type SymbolTableList = SymbolTable[];



function getCurrentEnv(envList : SymbolTableList): SymbolTable {
    assert(envList.length > 0);
    return envList[envList.length - 1];
}


function enterNewEnv(envList : SymbolTableList): SymbolTableList {
    envList.push(new Map<string, UnionSymbol>());
    return envList;
}


function exitCurrentEnv(envList : SymbolTableList): SymbolTableList {
    envList.pop();
    return envList;
}

function lookUpSymbol(envList : SymbolTableList, name: string, current: boolean): [boolean, UnionSymbol] {
    var end = current? envList.length - 1: 0;
    for(var i = envList.length - 1; i >= end; i --) {
        if(envList[i].has(name)) return [true, envList[i].get(name)];
    }
    // throw new Error(`Reference error: variable ${name} is not defined`)
    return [false, undefined];
}


function defineNewSymbol(envList : SymbolTableList, name: string, type: UnionSymbol) {
    let [found, t] = lookUpSymbol(envList, name, true);
    if (found) {
        throw new Error("Redefine symbol: " + name);
    } else {
        getCurrentEnv(envList).set(name, type);
    }
}



export function didAllPathReturn(stmts: Stmt<any>[]): boolean {
    return stmts.some( s => (s.tag === "return") || (s.tag === "if") && didAllPathReturn(s.if.body) && didAllPathReturn(s.else) && (s.elif.every((e => didAllPathReturn(e.body)))));
}


export function tcExpr(e : Expr<any>, envList : SymbolTableList) : Expr<Type> {
    switch(e.tag) {
        case "literal":
            if( e.value === "none") {
                return { ...e, a: "none" };
            } else if (e.value === "true") {
                return { ...e, a: "bool" }; 
            } else if (e.value === "false") {
                return { ...e, a: "bool" };
            } else {
                return { ...e, a: "int" };
            }
        case "binary": {
            const lhs = tcExpr(e.lhs, envList);
            const rhs = tcExpr(e.rhs, envList);
            switch(e.op) {
                case BinOp.Plus: 
                case BinOp.Minus:
                case BinOp.Mul:
                case BinOp.Div: 
                case BinOp.Mod:
                    if (lhs.a != "int" || rhs.a != "int") {
                        throw new TypeError(`Expected type INT but got type ${lhs.a} and type ${rhs.a}`)
                    }
                    return { ...e, a: "int", lhs, rhs};
                case BinOp.Equal:
                case BinOp.Unequal:
                    if (lhs.a != rhs.a) {
                        throw new TypeError(`Expected lhs and rhs to be same type but got type ${lhs.a} and type ${rhs.a}`)
                    }
                    return { ...e, a: "bool", lhs, rhs};
                case BinOp.Gt: 
                case BinOp.Ge:
                case BinOp.Lt:
                case BinOp.Le:
                    if (lhs.a != "int" || rhs.a != "int") {
                        throw new TypeError(`Expected type INT but got type ${lhs.a} and type ${rhs.a}`)
                    }
                    return { ...e, a: "bool", lhs, rhs };
                case BinOp.Is: 
                    // todo: fix this
                    return { ...e, a: "bool", lhs, rhs };
            }
        }

        case "unary": {
            const expr = tcExpr(e.expr, envList);
            switch(e.op) {
                case UniOp.Not: 
                    if (expr.a != "bool") {
                        throw new TypeError(`Expected type BOOL but got type ${expr.a}`)
                    }
                    return { ...e, a: "bool", expr: expr };
                case UniOp.Neg: 
                    if (expr.a != "int") {
                        throw new TypeError(`Expected type INT but got type ${expr.a}`)
                    }
                    return { ...e, a: "int", expr: expr };
            }
        }
        case "name": {
            let [found, t] = lookUpSymbol(envList, e.name, false);
            if (!found) {
                throw new ReferenceError(`Reference error: ${e.name} is not defined`)
            } 
            if (t.tag != "var") {
                throw new ReferenceError(`Reference error: ${e.name} is not a variable`)
            }
            return { ...e, a: t.type};
        }
        case "call": {
            if(e.name === "print") {
                if(e.args.length !== 1) { throw new Error("print expects a single argument"); }
                const newArgs = [tcExpr(e.args[0], envList)];
                const res : Expr<Type> = { ...e, a: "none", args: newArgs } ;
                return res;
            }

            let [found, t] = lookUpSymbol(envList, e.name, false);
            if(!found) {
                throw new ReferenceError(`function ${e.name} is not defined`);
            }
            if(t.tag != "func") {
                throw new ReferenceError(`${e.name} is not a function`);
            } 
            
            const [args, ret] = t.type;
            if(args.length !== e.args.length) {
                throw new Error(`Expected ${args.length} arguments but got ${e.args.length}`);
            }

            const newArgs = args.map((a, i) => {
                const argtyp = tcExpr(e.args[i], envList);
                if(a !== argtyp.a) { throw new TypeError(`Got ${argtyp.a} as argument ${i + 1}, expected ${a}`); }
                return argtyp
            });

            return { ...e, a: ret, args: newArgs };
        }
        case "getfield": {
            const newObj = tcExpr(e.obj, envList);
            if (!isClass(newObj.a)) {
                throw new Error("can not get member of non-class")
            }
            let className = newObj.a;
            let [found, t] = lookUpSymbol(envList, className, false);
            if(!found) {
                throw new ReferenceError(`class ${className} is not defined`);
            }
            if(t.tag !== "class") {
                throw new ReferenceError(`${className} is not a class name`);
            }
            let classData = t.type;
            if (!classData.fields.has(e.name)) {
                throw new ReferenceError(`class ${className} does not have field ${e.name}`)
            }

            return { ...e, a: classData.fields.get(e.name), obj: newObj };
        }
        case "method": {
            const newObj = tcExpr(e.obj, envList);
            if (!isClass(newObj.a)) {
                throw new Error("can not call method on non-class")
            }
            let className = newObj.a;
            let [found, t] = lookUpSymbol(envList, className, false);
            if(!found) {
                throw new ReferenceError(`class ${className} is not defined`);
            }
            if(t.tag !== "class") {
                throw new ReferenceError(`${className} is not a class name`);
            }
            let classData = t.type;
            if (!classData.methods.has(e.name)) {
                throw new ReferenceError(`class ${className} does not have method ${e.name}`)
            } 
            
            const [args, ret] = classData.methods.get(e.name);
            if(args.length !== e.args.length + 1) {
                throw new Error(`Expected ${args.length} arguments but got ${e.args.length + 1}`);
            }
            
            // exclude self
            const newArgs = args.slice(1).map((a, i) => {
                const argtyp = tcExpr(e.args[i], envList);
                if(a !== argtyp.a) { throw new TypeError(`Got ${argtyp.a} as argument ${i + 1}, expected ${a}`); }
                return argtyp;
            });
            return { ...e, a: ret, obj: newObj, args: newArgs };
        }
    }
}

export function tcFuncStmt(s : FuncStmt<any>, envList: SymbolTableList, currentReturn : Type) : FuncStmt<Type> {
    if (s.ret !== "none" && !didAllPathReturn(s.body)) {
        throw new Error(`All path in function ${s.name} must have a return statement`);
    }
    envList = enterNewEnv(envList);

    // define param
    s.params.forEach(p => defineNewSymbol(envList, p.name, {tag: "var", type: p.type}));

    // define local variables and functions
    s.body.forEach(s => {
        if (s.tag === "func") defineNewSymbol(envList, s.name, {tag: "func", type: [s.params.map(p => p.type), s.ret]});
        else if (s.tag === "var") defineNewSymbol(envList, s.var.name, {tag: "var", type: s.var.type});
    })

    checkDefinition(s.body);
    const newBody = s.body.map(bs => tcStmt(bs, envList, s.ret));
    
    exitCurrentEnv(envList);
    return { ...s, body: newBody };
}


export function tcVarStmt(s : VarStmt<any>, envList: SymbolTableList, currentReturn : Type) : VarStmt<Type> {
    const rhs = tcExpr(s.value, envList);
    if ( rhs.tag != "literal") {
        throw new Error(`can only initialize variable with literal`);
    }
    if ( s.var.type !== rhs.a && (!isClass(s.var.type) || rhs.a !== "none") ) {
        throw new TypeError(`Incompatible type when initializing variable ${s.var.name} of type ${s.var.type} using type ${rhs.a}`)
    }
    return { ...s, value: rhs };
}


export function tcStmt(s : Stmt<any>, envList: SymbolTableList, currentReturn : Type) : Stmt<Type> {
    switch(s.tag) {
        case "func": {
            return tcFuncStmt(s, envList, currentReturn);
        }

        case "var": {
            return tcVarStmt(s, envList, currentReturn);
        }

        case "class": {
            const fields = s.fields.map((v)=>tcVarStmt(v, envList, currentReturn)); //TODO: pass class info
            const methods = s.methods.map((v)=>tcFuncStmt(v, envList, currentReturn));
            return {
                ...s,
                fields,
                methods
            }
        }

        case "assign": {
            const rhs = tcExpr(s.value, envList);
            const lhs = tcExpr(s.name, envList);
            if( lhs.a !== rhs.a) {
                throw new TypeError(`Cannot assign ${rhs.a} to ${lhs.a}`);
            }
            
            return { ...s, name: lhs, value: rhs };
        }

        case "if": {
            const newIfCond = tcExpr(s.if.cond, envList);
            if(newIfCond.a != "bool") {
                throw new TypeError("Expect type BOOL in condition")
            }
            // functions = enterNewFunctionScope(functions);
            // variables = enterNewVariableScope(variables);
            const newIfBody = s.if.body.map(bs => tcStmt(bs, envList, currentReturn));

            // exitCurrentFunctionScope(functions);
            // exitCurrentVariableScope(variables);

            const newElif = s.elif.map(bs => {
                let cond = tcExpr(bs.cond, envList);
                if(cond.a != "bool") {
                    throw new TypeError("Expect type BOOL in condition")
                }
                // functions = enterNewFunctionScope(functions);
                // variables = enterNewVariableScope(variables);

                let body = bs.body.map(bb => tcStmt(bb, envList, currentReturn))

                // exitCurrentFunctionScope(functions);
                // exitCurrentVariableScope(variables);
                return {
                    cond: cond, 
                    body: body
                }});
            
            // functions = enterNewFunctionScope(functions);
            // variables = enterNewVariableScope(variables);
            
            const newElseBody = s.else.map(bs => tcStmt(bs, envList, currentReturn));

            // exitCurrentFunctionScope(functions);
            // exitCurrentVariableScope(variables);

            return {...s, if: {cond: newIfCond, body: newIfBody}, elif: newElif, else: newElseBody}
        }

        case "while": {
            const newCond = tcExpr(s.while.cond, envList);
            if(newCond.a != "bool") {
                throw new TypeError("Expect type BOOL in condition")
            }
            // functions = enterNewFunctionScope(functions);
            // variables = enterNewVariableScope(variables);

            const newBody = s.while.body.map(bs => tcStmt(bs, envList, currentReturn));

            // exitCurrentFunctionScope(functions);
            // exitCurrentVariableScope(variables);
            return { ...s, while: {cond: newCond, body: newBody}};
        }

        case "pass": {
            return s;
        }
        case "expr": {
            const ret = tcExpr(s.expr, envList);
            return { ...s, expr: ret };
        }
        case "return": {
            const valTyp = tcExpr(s.value, envList);
            if(valTyp.a !== currentReturn) {
                throw new TypeError(`${valTyp.a} returned but ${currentReturn} expected.`);
            }
            return { ...s, value: valTyp };
        }
    }
}

export function checkDefinition(p : Stmt<any>[]) {
    var LastDeclare = -1;
    var firstStmt = p.length;
    for(var i = 0; i < p.length; i ++) {
        if (p[i].tag === "var" || p[i].tag === "func" || p[i].tag === "class") {
            LastDeclare = i;
        } else {
            firstStmt = i;
        }

        if (LastDeclare > firstStmt) {
            throw new Error("Can not define variable and func after")
        }
    }
}


export function tcProgram(p : Stmt<any>[]) : Stmt<Type>[] {
    var envList: SymbolTableList = [];

    envList = enterNewEnv(envList);
    
    // check if all definition are proceeding statements
    checkDefinition(p);
    // define all the functions and variables
    p.forEach(s => {
        if (s.tag === "func") {
            defineNewSymbol(envList, s.name, {tag: "func", type: [s.params.map(p => p.type), s.ret]});
        }
        else if (s.tag === "var") {
            defineNewSymbol(envList, s.var.name, {tag: "var", type: s.var.type});
        }
        else if (s.tag === "class") {
            const methods = new Map<string, [Type[], Type]>();
            const fields = new Map<string, Type>();
            s.methods.forEach(m => {
                methods.set(m.name, [m.params.map((p)=>p.type), m.ret])
            })

            s.fields.forEach(m => {
                fields.set(m.var.name, m.var.type)
            })
            defineNewSymbol(envList, s.name, { tag: "class", type: { methods, fields }});
            }
    })

    return p.map(s => {
        const res = tcStmt(s, envList, "none");
        return res;
    });
}