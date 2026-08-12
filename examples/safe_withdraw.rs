fn withdraw(amount: u64) {
    assert!(balance() >= amount, "insufficient balance");
    send_to_user(amount);
}
