pub trait RemoveElem<T: PartialEq> {
    fn remove_element(&mut self, elem: T) -> bool;
}

impl<T: PartialEq> RemoveElem<T> for Vec<T> {
    fn remove_element(&mut self, elem: T) -> bool
    {
        match self.iter().position(|x| *x == elem) {
            Some(index) => {
                self.remove(index);
                return true;
            },
            None => return false
        }
    }
}