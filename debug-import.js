// Debug script to check what BindingMap import resolves to
import BindingMap from './src/input/BindingMap.js';

console.log('BindingMap import type:', typeof BindingMap);
console.log('BindingMap import value:', BindingMap);
console.log('BindingMap.default exists:', BindingMap.default !== undefined);
console.log('BindingMap.default type:', typeof BindingMap.default);

if (BindingMap.default) {
    console.log('Trying to create with .default:', new BindingMap.default());
} else {
    console.log('Trying to create directly:', new BindingMap());
}
