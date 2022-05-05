# cse 231 design md
Shangchen (Spencer) Du shdu@ucsd.edu
Shanbin Ke ske@ucsd.edu
Haofeng Xie haxie@ucsd.edu

We will first focus on supporting `List` and inheritance based on PA3 implementation. 

## List
A list is essentially an array and all elements should have the same type.
For `List`, a few changes will be add:

- in AST, add a new type for list
`{ tag: "list", type: Type }`
 and add index expression 
 `{ tag: A, expr: Expr<A>, idx: Expr<A> }`
- support this new type in parser and type checker
- allocating space for a list. Each element will take up 4 bytes in order. 
- add built-in method `__len__` for list objects


Ten test cases for list are here: [link](https://github.com/Cjkkkk/cse231-final-update/blob/pa3/tests/pa4-list.ts).

## Inheritance
We already supported class without inheritance in pa3. To support inheritance, we need to do the following:
(1) build the inheritance hierarchy tree, for example if A and B inherits from C, and D inherits from A, then we have a inheritance hierarchy tree like this:
```
    C
   / \
  A   B
 /
D
```
(2) we need to add fields of superclass into the subclass.
(3) We need to manage the layout the vtable and add a vtable pointer at the start of the object. 
```python=
class A(object):
    x: int = 1
    y: bool = True
    c: C = None
# would have memory layout like this in heap:
# [vtable_pointer] [x] [y] [c]
```

The vtable layout is managed by following rules:
* Every method that is presented in superclass needs to be presented in the subclass as well. And they should have same offset to the beginning of its class vtable definition.
* If a method is not overwritten by the subclass, then in the vtable it should point to the method defined by the superclass. 
* If a method is overwritten by the subclass, then in the vtable it should point to the method defined by the superclass.

```python=
class A(object):
    def f(self: A):
        pass

class B(A):
    def f(self: B):
        pass
        
    def g(self: B):
        pass

class C(B):
    def g(self: C):
        pass
```
This would produce a vtable like this in wasm:
```wasm=
(table 5 funcref)
(elem (i32.const 0)
    $A$f
    $B$f $B$g
    $B$f $C$g
)
```

Then instead of making a normal function call when we call a method on object, we get the vtable pointer of that object and add offset of that method to the vtable pointer to get the address of the function we want to call, then we use `call_indirect` to make the call:
```
a: A = None
a = C()
a.f()
```
would produce code like this:
```wasm
global.get $a
;; get vtable pointer of a, 0 is offset of vtable pointer
i32.const 0
i32.add
i32.load
;; offset 0 is method f
i32.const 0
i32.add
call_indirect ;; would call $B$f here
```

### Change to the code
- In `ast.ts`, we would add a string called `super` to the classStmt to keep track of the superclass.
- In `tc.ts`, we would allow assign a subclass value to a superclass variable and we would also look up in the superclass if we can not find field or method in the subclass.
- In `compiler.ts` (maybe a new file called `transform.ts`): we would perform the steps we metioned above to generate the correct code.

### Test
Ten test cases for inheritance are here: [link](https://github.com/Cjkkkk/cse231-final-update/blob/pa3/tests/pa4-inheritance.test.ts).